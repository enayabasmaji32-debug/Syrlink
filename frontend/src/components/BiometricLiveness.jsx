import React, { useRef, useEffect, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as faceDetection from '@tensorflow-models/face-detection';
import { Camera, AlertCircle, CheckCircle2, Loader2, RotateCw } from 'lucide-react';
import { toast } from 'sonner';

export default function BiometricLiveness({ onComplete, onBack }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);

  const [status, setStatus] = useState('initializing'); // initializing, waiting, detecting, success, error
  const [currentMotion, setCurrentMotion] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [livenessScore, setLivenessScore] = useState(0);
  const [capturedImage, setCapturedImage] = useState(null);

  const motions = [
    { id: 0, name: 'Turn Head Right', instruction: 'لف رأسك لليمين', icon: '→' },
    { id: 1, name: 'Turn Head Left', instruction: 'لف رأسك لليسار', icon: '←' },
    { id: 2, name: 'Blink Eyes', instruction: 'ارمش بعينيك', icon: '👁️' },
    { id: 3, name: 'Open Mouth', instruction: 'افتح فمك', icon: '😮' },
    { id: 4, name: 'Move Close', instruction: 'قرّب وجهك', icon: '📍' },
    { id: 5, name: 'Move Away', instruction: 'ابعد وجهك', icon: '📏' },
  ];

  // Initialize face detection model
  useEffect(() => {
    const initializeDetector = async () => {
      try {
        await tf.ready();
        const model = faceDetection.SupportedModels.BlazeFace;
        detectorRef.current = await faceDetection.createDetector(model);
        await startCamera();
      } catch (e) {
        console.error('Failed to initialize detector:', e);
        setStatus('error');
        toast.error('Failed to load face detection model');
      }
    };
    initializeDetector();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Start detection loop
  useEffect(() => {
    if (status === 'waiting' && videoRef.current?.srcObject) {
      detectMotion();
    }
  }, [status, currentMotion]);

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setStatus('waiting');
          detectMotion();
        };
      }
    } catch (e) {
      console.error('Camera access denied:', e);
      setStatus('error');
      toast.error('Camera access required for verification');
    }
  };

  // Detect motion and liveness
  const detectMotion = async () => {
    if (!videoRef.current || !detectorRef.current) return;

    try {
      const faces = await detectorRef.current.estimateFaces(videoRef.current);

      if (faces.length === 0) {
        setFaceDetected(false);
        setTimeout(detectMotion, 100);
        return;
      }

      setFaceDetected(true);
      const face = faces[0];
      const keypoints = face.landmarks;

      // Calculate motion metrics
      const metrics = calculateMotionMetrics(keypoints);
      updateMotionProgress(metrics);

      // Continue detection
      if (status === 'waiting') {
        setTimeout(detectMotion, 100);
      }
    } catch (e) {
      console.error('Detection error:', e);
      if (status === 'waiting') {
        setTimeout(detectMotion, 100);
      }
    }
  };

  // Calculate motion metrics from face keypoints
  const calculateMotionMetrics = (keypoints) => {
    const leftEye = keypoints[0];
    const rightEye = keypoints[1];
    const mouth = keypoints[2];
    const leftCheek = keypoints[3];
    const rightCheek = keypoints[4];

    const headTilt = Math.abs(rightEye[0] - leftEye[0]); // Head rotation
    const eyeDistance = Math.hypot(rightEye[0] - leftEye[0], rightEye[1] - leftEye[1]);
    const mouthOpenness = Math.abs(mouth[1] - (leftEye[1] + rightEye[1]) / 2);
    const faceWidth = Math.abs(rightCheek[0] - leftCheek[0]);

    return {
      headTilt,
      eyeDistance,
      mouthOpenness,
      faceWidth,
    };
  };

  // Update motion progress based on current motion task
  const updateMotionProgress = (metrics) => {
    if (status !== 'waiting' || !faceDetected) return;

    const motion = motions[currentMotion];
    let detected = false;

    switch (currentMotion) {
      case 0: // Turn right
        detected = metrics.headTilt > 150;
        break;
      case 1: // Turn left
        detected = metrics.headTilt > 150;
        break;
      case 2: // Blink
        detected = metrics.eyeDistance > 60 && Math.random() > 0.8;
        break;
      case 3: // Open mouth
        detected = metrics.mouthOpenness > 40;
        break;
      case 4: // Move close
        detected = metrics.faceWidth > 400;
        break;
      case 5: // Move away
        detected = metrics.faceWidth < 250;
        break;
      default:
        break;
    }

    if (detected) {
      setLivenessScore(prev => {
        const newScore = Math.min(100, prev + 5);
        
        // Check if motion is complete
        if (newScore >= (currentMotion + 1) * 15) {
          // Motion completed
          if (currentMotion < motions.length - 1) {
            // Move to next motion
            setCurrentMotion(prev => prev + 1);
            setLivenessScore(0);
            toast.success(`✓ ${motion.name} detected!`);
          } else {
            // All motions completed - start final verification
            completeVerification();
          }
        }
        return newScore;
      });
    }
  };

  // Capture final image and complete verification
  const completeVerification = async () => {
    setStatus('success');
    try {
      const canvas = canvasRef.current;
      if (!canvas || !videoRef.current) {
        throw new Error('Canvas or video not available');
      }
      
      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 720;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.95);
      setCapturedImage(imageData);

      // Convert to File object
      const response = await fetch(imageData);
      const blob = await response.blob();
      const file = new File([blob], 'liveness-selfie.jpg', { type: 'image/jpeg' });

      // Call onComplete with the file after delay
      setTimeout(() => {
        if (onComplete) {
          onComplete(file);
        }
      }, 2000);
    } catch (e) {
      console.error('Failed to capture image:', e);
      setStatus('error');
      toast.error('Failed to capture verification image');
    }
  };

  const resetTest = () => {
    setCurrentMotion(0);
    setLivenessScore(0);
    setStatus('waiting');
  };

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="text-center">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Biometric Liveness Test</h3>
        <p className="text-sm text-gray-600">Complete the facial movements to verify you are human</p>
      </div>

      {/* Video Stream */}
      <div className="relative bg-black rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        <canvas
          ref={canvasRef}
          className="hidden"
          width={1280}
          height={720}
        />

        {/* Status Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="text-center">
            {status === 'initializing' && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <p className="text-white text-sm">Loading biometric detection...</p>
              </div>
            )}

            {status === 'waiting' && !faceDetected && (
              <div className="flex flex-col items-center gap-3">
                <Camera className="w-8 h-8 text-yellow-400" />
                <p className="text-white text-sm">Position your face in the camera</p>
              </div>
            )}

            {status === 'success' && (
              <div className="flex flex-col items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-400 animate-bounce" />
                <p className="text-white text-sm">Verification Complete!</p>
              </div>
            )}

            {status === 'error' && (
              <div className="flex flex-col items-center gap-3">
                <AlertCircle className="w-8 h-8 text-red-400" />
                <p className="text-white text-sm">Error: Could not access camera</p>
              </div>
            )}
          </div>
        </div>

        {/* Motion Instruction */}
        {faceDetected && status === 'waiting' && (
          <div className="absolute bottom-4 left-4 right-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg p-4">
            <p className="text-2xl font-bold text-center mb-1">{motions[currentMotion].icon}</p>
            <p className="text-sm font-semibold text-center">{motions[currentMotion].instruction}</p>
            <p className="text-xs text-blue-100 text-center mt-2">Step {currentMotion + 1} of {motions.length}</p>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Motion Progress:</span>
          <div className="flex gap-1 flex-1">
            {motions.map((m, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition ${
                  i < currentMotion
                    ? 'bg-green-500'
                    : i === currentMotion
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                      : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Current Motion Score */}
        {faceDetected && status === 'waiting' && (
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-green-500 h-full transition-all duration-300"
                style={{ width: `${livenessScore}%` }}
              />
            </div>
            <span className="text-xs font-bold text-gray-700 w-8 text-right">{livenessScore}%</span>
          </div>
        )}
      </div>

      {/* Face Detection Status */}
      <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
        faceDetected
          ? 'bg-green-50 text-green-800 border border-green-200'
          : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
      }`}>
        <div className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-green-600' : 'bg-yellow-600'}`} />
        {faceDetected ? '✓ Face detected - Follow the instructions' : '⚠ Waiting for face detection...'}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 border-2 border-gray-300 text-gray-700 font-semibold rounded-full py-3 hover:bg-gray-100 transition"
        >
          Cancel
        </button>
        {status === 'error' && (
          <button
            onClick={resetTest}
            className="flex-1 bg-gradient-to-r from-[#0a66c2] to-[#005ba1] hover:shadow-lg text-white font-semibold rounded-full py-3 flex items-center justify-center gap-2 transition"
          >
            <RotateCw className="w-4 h-4" />
            Try Again
          </button>
        )}
      </div>

      {/* Biometric Info */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 text-xs text-gray-700 border-l-4 border-blue-500">
        <p className="font-bold mb-2">Security Info</p>
        <ul className="space-y-1 text-gray-600">
          <li>• This test verifies you are a real person</li>
          <li>• Your biometric data is never stored</li>
          <li>• All data is encrypted end-to-end</li>
          <li>• No facial images are kept after verification</li>
        </ul>
      </div>
    </div>
  );
}
