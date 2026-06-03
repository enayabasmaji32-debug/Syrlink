import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as tf from '@tensorflow/tfjs'
import * as faceDetection from '@tensorflow-models/face-detection'
import { Camera, AlertCircle, CheckCircle2, Loader2, RotateCw } from 'lucide-react'
import { toast } from 'sonner'

const isSecureContext = () => {
  if (typeof window === 'undefined') return false
  const hostname = window.location.hostname
  return window.location.protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1'
}

const getCameraErrorMessage = (error) => {
  if (!error) return 'Camera access failed. Please try again.'
  if (error.name === 'NotAllowedError') {
    return 'Camera permission denied. Please allow access in the browser prompt and retry.'
  }
  if (error.name === 'NotFoundError') {
    return 'No camera device was found. Please connect a camera and retry.'
  }
  if (error.name === 'AbortError') {
    return 'Camera request was aborted. Please retry.'
  }
  if (error.name === 'OverconstrainedError') {
    return 'Your camera does not support the required settings. Try a different camera or device.'
  }
  if (error.name === 'TimeoutError') {
    return 'Camera request timed out. Please retry.'
  }
  if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
    return 'Unable to start the camera. Another app may be using it.'
  }
  return error.message || 'Could not access camera. Please retry or use a supported device.'
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const distance = (a, b) => {
  if (!a || !b) return 0
  const dx = (a.x ?? a[0] ?? 0) - (b.x ?? b[0] ?? 0)
  const dy = (a.y ?? a[1] ?? 0) - (b.y ?? b[1] ?? 0)
  return Math.sqrt(dx * dx + dy * dy)
}

const getPoint = (keypoints, name) => {
  if (!Array.isArray(keypoints)) return null
  return keypoints.find((point) => point?.name === name) || null
}

const calculateHeadYaw = (keypoints, boundingBox) => {
  const leftEye = getPoint(keypoints, 'left_eye')
  const rightEye = getPoint(keypoints, 'right_eye')
  const nose = getPoint(keypoints, 'nose_tip')
  if (!leftEye || !rightEye || !nose || !boundingBox) return 0

  const eyeCenterX = (leftEye.x + rightEye.x) / 2
  const noseX = nose.x
  const faceWidth = Math.max(1, Math.abs(rightEye.x - leftEye.x))
  const normalized = (noseX - eyeCenterX) / faceWidth
  return clamp(normalized * 90, -45, 45)
}

const calculateMouthOpenness = (keypoints, boundingBox) => {
  const leftMouth = getPoint(keypoints, 'mouth_left')
  const rightMouth = getPoint(keypoints, 'mouth_right')
  if (leftMouth && rightMouth && boundingBox) {
    const mouthWidth = distance(leftMouth, rightMouth)
    const boxWidth = Math.max(1, boundingBox.width)
    return mouthWidth / boxWidth
  }
  return 0
}

const calculateEyeScore = (keypoints) => {
  const leftEye = getPoint(keypoints, 'left_eye')
  const rightEye = getPoint(keypoints, 'right_eye')
  return {
    left: leftEye?.score ?? 1,
    right: rightEye?.score ?? 1,
  }
}

const formatPercent = (value) => `${Math.round(value)}%`

export default function BiometricLiveness({ onComplete, onBack }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const detectorRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const motionHoldRef = useRef(0)
  const blinkDetectedRef = useRef(false)
  const mouthDetectedRef = useRef(false)
  const lastFaceTimeRef = useRef(Date.now())

  const [status, setStatus] = useState('initializing')
  const [cameraError, setCameraError] = useState('')
  const [faceDetected, setFaceDetected] = useState(false)
  const [currentMotion, setCurrentMotion] = useState(0)
  const [motionProgress, setMotionProgress] = useState(0)
  const [predictionInfo, setPredictionInfo] = useState({ yaw: 0, mouth: 0, eyeScore: 1 })

  const motions = [
    { id: 0, title: 'Turn Head Right', hint: 'لف رأسك لليمين حتى ترى النقطة الزرقاء', icon: '→' },
    { id: 1, title: 'Turn Head Left', hint: 'لف رأسك لليسار حتى ترى النقطة الزرقاء', icon: '←' },
    { id: 2, title: 'Blink Eyes', hint: 'أغمض عينيك ثم افتحهما بوضوح', icon: '👁️' },
    { id: 3, title: 'Open Mouth', hint: 'افتح فمك قليلاً لتأكيد الحياة', icon: '🗣️' },
  ]

  const stopVideo = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (detectorRef.current) {
      detectorRef.current.dispose?.()
      detectorRef.current = null
    }
  }, [])

  const captureSelfie = async () => {
    const video = videoRef.current
    if (!video) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'selfie.png', { type: 'image/png' })
          resolve(file)
        } else {
          resolve(null)
        }
      }, 'image/png')
    })
  }

  const markMotionComplete = useCallback(async () => {
    const next = currentMotion + 1
    setMotionProgress(0)
    motionHoldRef.current = 0
    if (next >= motions.length) {
      setStatus('complete')
      const selfieFile = await captureSelfie()
      if (selfieFile) {
        onComplete(selfieFile)
      } else {
        toast.error('Unable to capture selfie. Please try again.')
      }
      return
    }
    setCurrentMotion(next)
  }, [currentMotion, motions.length, onComplete])

  const drawOverlay = (prediction) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!prediction) return

    const box = prediction.boundingBox
    if (box) {
      ctx.strokeStyle = '#0a66c2'
      ctx.lineWidth = 3
      ctx.strokeRect(box.xMin, box.yMin, box.width, box.height)
    }

    const keypoints = prediction.keypoints || []
    ctx.fillStyle = '#0a66c2'
    keypoints.forEach((keypoint) => {
      const x = keypoint.x ?? keypoint[0]
      const y = keypoint.y ?? keypoint[1]
      if (typeof x === 'number' && typeof y === 'number') {
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  }

  const processDetection = useCallback(async () => {
    const video = videoRef.current
    const detector = detectorRef.current
    if (!video || !detector) return
    if (video.readyState < 2) {
      rafRef.current = requestAnimationFrame(processDetection)
      return
    }

    try {
      const predictions = await detector.estimateFaces(video, { flipHorizontal: true })
      const prediction = predictions?.[0] || null
      if (!prediction) {
        setFaceDetected(false)
        setPredictionInfo({ yaw: 0, mouth: 0, eyeScore: 1 })
        motionHoldRef.current = 0
        drawOverlay(null)
        const elapsed = Date.now() - lastFaceTimeRef.current
        if (elapsed > 3000) {
          setStatus('no-face')
        }
        rafRef.current = requestAnimationFrame(processDetection)
        return
      }

      setFaceDetected(true)
      lastFaceTimeRef.current = Date.now()
      setStatus('verifying')

      const keypoints = prediction.keypoints || []
      const yaw = calculateHeadYaw(keypoints, prediction.boundingBox)
      const mouthRatio = calculateMouthOpenness(keypoints, prediction.boundingBox)
      const eyeScore = calculateEyeScore(keypoints)
      setPredictionInfo({ yaw, mouth: mouthRatio, eyeScore: Math.min(1, (eyeScore.left + eyeScore.right) / 2) })

      drawOverlay(prediction)

      const thresholdTargets = {
        0: yaw > 15,
        1: yaw < -15,
        2: eyeScore.left < 0.45 && eyeScore.right < 0.45,
        3: mouthRatio > 0.32,
      }

      const currentTarget = thresholdTargets[currentMotion]
      if (currentTarget) {
        motionHoldRef.current += 1
        setMotionProgress(Math.min(100, (motionHoldRef.current / 12) * 100))
      } else {
        motionHoldRef.current = 0
        setMotionProgress(0)
      }

      if (motionHoldRef.current >= 10) {
        if (currentMotion === 2) {
          blinkDetectedRef.current = true
        }
        if (currentMotion === 3) {
          mouthDetectedRef.current = true
        }
        await markMotionComplete()
      }
    } catch (error) {
      console.error('Biometric detection failed:', error)
      setStatus('error')
      toast.error('Face detection failed. Please try again.')
    }

    rafRef.current = requestAnimationFrame(processDetection)
  }, [currentMotion, markMotionComplete])

  const startCamera = async () => {
    if (!isSecureContext()) {
      setCameraError('Camera access requires HTTPS or localhost.')
      setStatus('error')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (error) {
      const message = getCameraErrorMessage(error)
      setCameraError(message)
      setStatus('error')
      toast.error(message)
    }
  }

  const loadModel = useCallback(async () => {
    try {
      await tf.ready()
      detectorRef.current = await faceDetection.createDetector(faceDetection.SupportedModels.MediaPipeFaceDetector, {
        runtime: 'tfjs',
        maxFaces: 1,
        modelType: 'short',
      })
    } catch (error) {
      console.error('Face detector load failed:', error)
      setStatus('error')
      toast.error('Could not load face detection model. Please refresh and retry.')
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      setStatus('initializing')
      await loadModel()
      if (!mounted) return
      await startCamera()
      if (!mounted) return
      setStatus('ready')
      rafRef.current = requestAnimationFrame(processDetection)
    }

    init()

    return () => {
      mounted = false
      stopVideo()
    }
  }, [loadModel, processDetection, stopVideo])

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Biometric Liveness Check</h3>
            <p className="text-sm text-slate-600">أكمل الحركات التالية أمام الكاميرا حتى يكتمل التحقق.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
            <Camera className="h-4 w-4" /> Live video
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[1.4fr_0.6fr]">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-950/5">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
            {status === 'initializing' && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 text-white">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}
            {status === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-500/10 text-red-700 p-4 text-center">
                <AlertCircle className="mb-2 h-8 w-8" />
                <p>{cameraError || 'حدث خطأ أثناء الوصول إلى الكاميرا'}</p>
              </div>
            )}
            {!faceDetected && status === 'verifying' && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 text-white">
                <p className="text-sm font-semibold">لم يتم اكتشاف الوجه بعد. تأكد من وضوح الإضاءة ووجه الكاميرا مباشرة.</p>
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">الخطوة الحالية</p>
              <p className="mt-2 text-lg font-bold text-slate-900">{motions[currentMotion]?.title}</p>
              <p className="mt-1 text-sm text-slate-600">{motions[currentMotion]?.hint}</p>
            </div>

            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                <span>الحركة</span>
                <span>{motionProgress ? formatPercent(motionProgress) : '0%'}</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" style={{ width: `${motionProgress}%` }} />
              </div>
            </div>

            <div className="rounded-3xl bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span>معلومات الكشف</span>
              </div>
              <div className="grid gap-2 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span>زاوية الرأس</span>
                  <span>{predictionInfo.yaw.toFixed(1)}°</span>
                </div>
                <div className="flex justify-between">
                  <span>فتح الفم</span>
                  <span>{predictionInfo.mouth.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>ثقة العين</span>
                  <span>{predictionInfo.eyeScore.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-4 text-sm text-slate-600 shadow-sm">
              <p className="font-semibold text-slate-800">تعليمات</p>
              <ul className="mt-3 space-y-2 list-disc pl-5">
                <li>اجلس أمام الكاميرا وزد الإضاءة إن لزم.</li>
                <li>لا تغطي وجهك بيد أو نظارة داكنة.</li>
                <li>انتظر حتى تُظهر الشريط الأخضر اكتمال الحركة.</li>
                <li>عند الانتهاء، سيتم التقاط صورة سيلفي تلقائياً.</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  stopVideo()
                  onBack()
                }}
                className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Back
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (status === 'ready' || status === 'no-face' || status === 'verifying') {
                    setCurrentMotion(0)
                    setMotionProgress(0)
                    motionHoldRef.current = 0
                    setStatus('ready')
                    if (!rafRef.current) rafRef.current = requestAnimationFrame(processDetection)
                  }
                }}
                className="flex-1 rounded-full bg-gradient-to-r from-[#0a66c2] to-[#005ba1] px-4 py-3 text-sm font-semibold text-white transition hover:shadow-lg"
              >
                Restart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
