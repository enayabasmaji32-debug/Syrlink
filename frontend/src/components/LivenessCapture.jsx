import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Loader2, Camera, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { livenessApi } from '../api';

const CHALLENGE_INSTRUCTIONS = {
  blink: 'ابقَ ثابتاً وارمش بشكل طبيعي',
  turn_left: 'حرّك رأسك ببطء ناحية اليسار ثم عد للمنتصف',
  turn_right: 'حرّك رأسك ببطء ناحية اليمين ثم عد للمنتصف',
  smile: 'ابتسم بشكل طبيعي',
  nod: 'حرّك رأسك للأعلى والأسفل ببطء',
};

const RECORD_DURATION_MS = 5000;
const TARGET_FRAMES = 30;
const MAX_FRAMES = 60;

export default function LivenessCapture({ onSuccess, onCancel }) {
  const [phase, setPhase] = useState('idle'); // idle | loading-challenge | ready | recording | processing | success | error
  const [challenge, setChallenge] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState(null);
  const [countdown, setCountdown] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      return stream;
    } catch (err) {
      throw new Error('تعذر فتح الكاميرا — تأكد من إعطاء الإذن');
    }
  }, []);

  const fetchChallenge = useCallback(async () => {
    setPhase('loading-challenge');
    setErrorMsg('');
    setResult(null);
    try {
      const res = await livenessApi.challenge();
      setChallenge(res);
      await startCamera();
      setPhase('ready');
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || err.message || 'فشل في جلب التحدي');
      setPhase('error');
    }
  }, [startCamera]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    recordedChunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : 'video/webm';

    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      processVideo();
    };

    recorder.start(100); // collect in 100ms chunks
    setPhase('recording');
    setCountdown(5);

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const processVideo = useCallback(async () => {
    setPhase('processing');
    try {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const videoUrl = URL.createObjectURL(blob);
      const video = document.createElement('video');
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('تعذر تحميل الفيديو المسجّل'));
      });

      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');

      const duration = video.duration || RECORD_DURATION_MS / 1000;
      const frameCount = Math.min(TARGET_FRAMES, Math.floor(duration * 6)); // ~6 fps sampling
      const frames = [];

      for (let i = 0; i < frameCount; i++) {
        const time = (i / Math.max(frameCount - 1, 1)) * duration;
        video.currentTime = time;
        await new Promise((r) => {
          video.onseeked = r;
          // Fallback in case seeked doesn't fire
          setTimeout(r, 100);
        });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        frames.push(dataUrl);
      }

      URL.revokeObjectURL(videoUrl);

      if (frames.length < 15) {
        throw new Error('لم يُستخرج عدد كافٍ من الـ frames — حاول مرة أخرى');
      }

      const verifyRes = await livenessApi.verify(challenge.session_id, frames.slice(0, MAX_FRAMES));
      setResult(verifyRes);
      if (verifyRes.verified) {
        setPhase('success');
        if (onSuccess) onSuccess(verifyRes);
      } else {
        setErrorMsg(verifyRes.detail || 'لم يتم التحقق — حاول مرة أخرى');
        setPhase('error');
      }
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || err.message || 'حدث خطأ أثناء التحليل');
      setPhase('error');
    } finally {
      stopStream();
    }
  }, [challenge, onSuccess, stopStream]);

  const handleRetry = useCallback(() => {
    stopStream();
    setPhase('idle');
    setErrorMsg('');
    setResult(null);
    setChallenge(null);
    fetchChallenge();
  }, [fetchChallenge, stopStream]);

  const handleCancel = useCallback(() => {
    stopStream();
    if (timerRef.current) clearInterval(timerRef.current);
    if (onCancel) onCancel();
  }, [onCancel, stopStream]);

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
      <h2 className="text-lg font-semibold text-center">التحقق من الوجه</h2>

      {phase === 'idle' && (
        <div className="text-center space-y-4">
          <p className="text-sm text-gray-600">
            سجل مقطع فيديو قصير (5 ثواني) للتحقق من أنك شخص حقيقي.
          </p>
          <Button onClick={fetchChallenge} className="w-full">
            <Camera className="w-4 h-4 mr-2" />
            بدء التحقق
          </Button>
          {onCancel && (
            <Button variant="ghost" onClick={handleCancel} className="w-full">
              إلغاء
            </Button>
          )}
        </div>
      )}

      {(phase === 'loading-challenge') && (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0a66c2]" />
          <p className="text-sm text-gray-600 mt-2">جارٍ التحضير…</p>
        </div>
      )}

      {(phase === 'ready' || phase === 'recording') && (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {phase === 'recording' && (
              <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                ● {countdown}
              </div>
            )}
            {challenge && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-sm p-2 text-center">
                {CHALLENGE_INSTRUCTIONS[challenge.challenge] || challenge.instructions}
              </div>
            )}
          </div>

          {phase === 'ready' && (
            <div className="text-center space-y-3">
              <p className="text-sm text-gray-600">
                عندما تكون جاهزاً، اضغط <strong>تسجيل</strong> واتبع التعليمات لمدة 5 ثوانٍ.
              </p>
              <Button onClick={startRecording} className="w-full">
                <Camera className="w-4 h-4 mr-2" />
                تسجيل
              </Button>
              <Button variant="ghost" onClick={handleCancel} className="w-full">
                إلغاء
              </Button>
            </div>
          )}

          {phase === 'recording' && (
            <div className="text-center">
              <p className="text-sm text-gray-600">جارٍ التسجيل…</p>
            </div>
          )}
        </div>
      )}

      {phase === 'processing' && (
        <div className="text-center py-8 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0a66c2]" />
          <p className="text-sm text-gray-600">جارٍ تحليل الفيديو…</p>
          <p className="text-xs text-gray-400">قد يستغرق بضع ثوانٍ</p>
        </div>
      )}

      {phase === 'success' && (
        <div className="text-center py-6 space-y-4">
          <CheckCircle className="w-12 h-12 mx-auto text-green-600" />
          <p className="text-base font-semibold text-green-700">تم التحقق بنجاح!</p>
          {result && (
            <p className="text-xs text-gray-500">
              النتيجة: {Math.round(result.score * 100)}%
            </p>
          )}
          <Button onClick={handleCancel} className="w-full">
            متابعة
          </Button>
        </div>
      )}

      {phase === 'error' && (
        <div className="text-center py-6 space-y-4">
          <XCircle className="w-12 h-12 mx-auto text-red-600" />
          <p className="text-base font-semibold text-red-700">فشل التحقق</p>
          <p className="text-sm text-gray-600">{errorMsg}</p>
          <div className="flex gap-2">
            <Button onClick={handleRetry} className="flex-1">
              <RefreshCw className="w-4 h-4 mr-2" />
              إعادة المحاولة
            </Button>
            <Button variant="ghost" onClick={handleCancel} className="flex-1">
              إلغاء
            </Button>
          </div>
        </div>
      )}

      {/* Hidden canvas for frame extraction */}
      <canvas ref={canvasRef} className="hidden" width={320} height={240} />
    </div>
  );
}
