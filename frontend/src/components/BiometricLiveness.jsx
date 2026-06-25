import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, AlertCircle, Camera } from 'lucide-react';
import * as faceapi from 'face-api.js';
import { toast } from 'sonner';

/**
 * BiometricLiveness Component using face-api.js
 * Performs real-time biometric liveness detection with:
 * - Face detection and landmarks
 * - Head pose estimation (turn left/right)
 * - Mouth opening detection
 * - Eye blink detection
 * - Progress tracking for each movement
 * - Auto-capture and submission
 */
export default function BiometricLiveness({ onComplete, onBack }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Movement detection state
  const [currentMovement, setCurrentMovement] = useState(0);
  const [movementProgress, setMovementProgress] = useState({
    0: false, // Turn right
    1: false, // Turn left
    2: false, // Blink
    3: false, // Open mouth
  });

  const analysisStateRef = useRef({
    headRotation: { pitch: 0, yaw: 0, roll: 0 },
    eyeOpenness: [1, 1],
    mouthOpenness: 0,
    lastBlinkTime: 0,
    blinkInProgress: false,
    eyeClosureStart: null,
  });

  const MOVEMENTS = [
    { id: 0, label: 'Turn Right', instruction: 'لف رأسك لليمين', threshold: 15 },
    { id: 1, label: 'Turn Left', instruction: 'لف رأسك لليسار', threshold: -15 },
    { id: 2, label: 'Blink', instruction: 'ارمش بعينيك', threshold: 0.5 },
    { id: 3, label: 'Open Mouth', instruction: 'افتح فمك', threshold: 0.3 },
  ];

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsLoading(true);
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);

        setError(null);
        setIsLoading(false);
        setIsAnalyzing(true);
      } catch (err) {
        console.error('Failed to load face detection models:', err);
        setError('Failed to load face detection models. Please refresh.');
        toast.error('Failed to initialize face detection');
        setIsLoading(false);
      }
    };

    loadModels();
  }, []);

  // Access webcam
  useEffect(() => {
    if (!isAnalyzing) return;

    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
          };
        }
      } catch (err) {
        console.error('Camera access denied:', err);
        setError('Camera access is required for verification');
        toast.error('Camera access denied');
        setIsAnalyzing(false);
      }
    };

    setupCamera();
  }, [isAnalyzing]);

  // Calculate head pose from landmarks
  const estimateHeadPose = (landmarks) => {
    if (!landmarks || landmarks.length < 68) {
      return { pitch: 0, yaw: 0, roll: 0 };
    }

    // Key landmarks
    const noseTip = landmarks[30]; // Nose tip
    const rightEye = landmarks[36]; // Right eye outer corner
    const leftEye = landmarks[45]; // Left eye outer corner
    const chin = landmarks[8]; // Chin
    const forehead = landmarks[27]; // Forehead center

    const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
    const faceCenter = {
      x: (rightEye.x + leftEye.x) / 2,
      y: (rightEye.y + leftEye.y) / 2,
    };

    // Yaw (left/right rotation)
    const noseToEyeLeft = noseTip.x - leftEye.x;
    const noseToEyeRight = rightEye.x - noseTip.x;
    const yaw = ((noseToEyeRight - noseToEyeLeft) / eyeDistance) * 90;

    // Pitch (up/down rotation)
    const foreheadToChin = chin.y - forehead.y;
    const noseToFace = noseTip.y - faceCenter.y;
    const pitch = (noseToFace / foreheadToChin) * 45;

    // Roll (tilt rotation)
    const eyeSlope = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
    const roll = (eyeSlope * 180) / Math.PI;

    return {
      pitch: Math.round(pitch),
      yaw: Math.round(yaw),
      roll: Math.round(roll),
    };
  };

  // Calculate mouth openness
  const calculateMouthOpenness = (landmarks) => {
    if (!landmarks || landmarks.length < 68) return 0;

    const upperLip = landmarks[62]; // Upper lip center
    const lowerLip = landmarks[66]; // Lower lip center
    const mouthLeft = landmarks[61]; // Mouth left
    const mouthRight = landmarks[65]; // Mouth right

    const mouthHeight = Math.abs(upperLip.y - lowerLip.y);
    const mouthWidth = Math.abs(mouthRight.x - mouthLeft.x);

    return mouthWidth > 0 ? mouthHeight / mouthWidth : 0;
  };

  // Calculate eye openness
  const calculateEyeOpenness = (landmarks, eye) => {
    if (!landmarks || landmarks.length < 68) return 1;

    let eyeTop, eyeBottom, eyeLeft, eyeRight;

    if (eye === 'left') {
      eyeLeft = landmarks[45]; // Left eye outer corner
      eyeRight = landmarks[42]; // Left eye inner corner
      eyeTop = landmarks[43]; // Left eye top
      eyeBottom = landmarks[47]; // Left eye bottom
    } else {
      eyeLeft = landmarks[39]; // Right eye inner corner
      eyeRight = landmarks[36]; // Right eye outer corner
      eyeTop = landmarks[37]; // Right eye top
      eyeBottom = landmarks[41]; // Right eye bottom
    }

    const eyeHeight = Math.abs(eyeTop.y - eyeBottom.y);
    const eyeWidth = Math.abs(eyeRight.x - eyeLeft.x);

    return eyeWidth > 0 ? eyeHeight / eyeWidth : 1;
  };

  // Check movement threshold
  const checkMovementThreshold = (movement, pose, eyeOpenness, mouthOpenness) => {
    switch (movement) {
      case 0: // Turn right
        return pose.yaw > MOVEMENTS[0].threshold;
      case 1: // Turn left
        return pose.yaw < MOVEMENTS[1].threshold;
      case 2: // Blink
        return eyeOpenness[0] < 0.2 || eyeOpenness[1] < 0.2;
      case 3: // Open mouth
        return mouthOpenness > MOVEMENTS[3].threshold;
      default:
        return false;
    }
  };

  // Draw analysis on canvas
  const drawAnalysis = (detections, landmarks, pose, eyeOpenness, mouthOpenness, ctx, imageWidth, imageHeight) => {
    ctx.clearRect(0, 0, imageWidth, imageHeight);

    // Draw landmarks
    if (landmarks) {
      ctx.fillStyle = '#00FF00';
      landmarks.forEach((lm) => {
        ctx.fillRect(lm.x - 2, lm.y - 2, 4, 4);
      });
    }

    // Draw current instruction
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;

    const instruction = MOVEMENTS[currentMovement].instruction;
    ctx.strokeText(instruction, imageWidth / 2, 60);
    ctx.fillText(instruction, imageWidth / 2, 60);

    // Draw movement status
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';

    MOVEMENTS.forEach((m, idx) => {
      const color = movementProgress[idx] ? '#00FF00' : '#FF6B6B';
      ctx.fillStyle = color;
      ctx.fillRect(20 + idx * 150, imageHeight - 50, 140, 30);
      
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(m.label, 30 + idx * 150, imageHeight - 25);
    });

    // Draw analytics
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';

    const analytics = [
      `Head Yaw: ${pose.yaw}°`,
      `Mouth: ${(mouthOpenness * 100).toFixed(0)}%`,
      `Eyes: L=${(eyeOpenness[0] * 100).toFixed(0)}% R=${(eyeOpenness[1] * 100).toFixed(0)}%`,
    ];

    analytics.forEach((text, idx) => {
      const y = imageHeight - 120 + idx * 25;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(text, 20, y);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(text, 20, y);
    });
  };

  // Main analysis loop
  const analyzeFrame = async () => {
    if (!videoRef.current || videoRef.current.readyState !== 4) {
      requestAnimationFrame(analyzeFrame);
      return;
    }

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      const detections = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks();

      if (!detections) {
        requestAnimationFrame(analyzeFrame);
        return;
      }

      const landmarks = detections.landmarks.positions;
      const imageWidth = video.videoWidth;
      const imageHeight = video.videoHeight;

      canvas.width = imageWidth;
      canvas.height = imageHeight;
      const ctx = canvas.getContext('2d');

      // Calculate metrics
      const pose = estimateHeadPose(landmarks);
      const eyeOpenness = [
        calculateEyeOpenness(landmarks, 'left'),
        calculateEyeOpenness(landmarks, 'right'),
      ];
      const mouthOpenness = calculateMouthOpenness(landmarks);

      const state = analysisStateRef.current;
      state.headRotation = pose;
      state.eyeOpenness = eyeOpenness;
      state.mouthOpenness = mouthOpenness;

      // Draw analysis
      drawAnalysis(detections, landmarks, pose, eyeOpenness, mouthOpenness, ctx, imageWidth, imageHeight);

      // Check movement threshold
      if (checkMovementThreshold(currentMovement, pose, eyeOpenness, mouthOpenness)) {
        setMovementProgress((prev) => {
          const updated = { ...prev };
          updated[currentMovement] = true;

          if (currentMovement < 3) {
            setCurrentMovement(currentMovement + 1);
            toast.success(`✓ ${MOVEMENTS[currentMovement].label} detected!`);
          } else {
            captureAndSubmit();
          }

          return updated;
        });
      }
    } catch (err) {
      console.error('Error during analysis:', err);
    }

    requestAnimationFrame(analyzeFrame);
  };

  // Capture and submit
  const captureAndSubmit = async () => {
    try {
      const video = videoRef.current;
      const captureCanvas = document.createElement('canvas');
      captureCanvas.width = video.videoWidth;
      captureCanvas.height = video.videoHeight;
      const ctx = captureCanvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      captureCanvas.toBlob((blob) => {
        const file = new File([blob], 'biometric_selfie.jpg', { type: 'image/jpeg' });
        onComplete(file);
      }, 'image/jpeg', 0.95);
    } catch (err) {
      console.error('Error capturing frame:', err);
      toast.error('Failed to capture image');
    }
  };

  // Start analysis loop
  useEffect(() => {
    if (isAnalyzing) {
      const frameId = requestAnimationFrame(analyzeFrame);
      return () => cancelAnimationFrame(frameId);
    }
  }, [isAnalyzing, currentMovement]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900">
        <Camera className="w-16 h-16 text-blue-500 mb-4 animate-spin" />
        <p className="text-white text-lg">Loading face detection models...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <p className="text-white text-lg mb-4">{error}</p>
        <button
          onClick={onBack}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ transform: 'scaleX(-1)' }}
        />
      </div>

      <div className="bg-gray-800 p-4 border-t border-gray-700">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white text-lg font-semibold">
              تحقق بيومتري {`(${currentMovement + 1}/4)`} | Biometric Verification
            </h2>
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-300 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {MOVEMENTS.map((movement, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg text-center transition-all ${
                  movementProgress[idx]
                    ? 'bg-green-600 text-white'
                    : idx === currentMovement
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                <div className="flex justify-center mb-1">
                  {movementProgress[idx] ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-current" />
                  )}
                </div>
                <p className="text-xs font-semibold">{movement.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
