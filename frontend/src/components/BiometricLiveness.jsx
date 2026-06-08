import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, AlertCircle, Camera } from 'lucide-react';
import * as faceDetection from '@tensorflow-models/face-detection';
import '@tensorflow/tfjs';
import { toast } from 'sonner';

/**
 * BiometricLiveness Component
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
  const [detector, setDetector] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Movement detection state
  const [currentMovement, setCurrentMovement] = useState(0); // 0: turn right, 1: turn left, 2: blink, 3: open mouth
  const [movementProgress, setMovementProgress] = useState({
    0: false, // Turn right
    1: false, // Turn left
    2: false, // Blink
    3: false, // Open mouth
  });

  // Face landmarks and analysis state
  const analysisStateRef = useRef({
    headRotation: { pitch: 0, yaw: 0, roll: 0 },
    eyeOpenness: [1, 1], // Left, Right
    mouthOpenness: 0,
    faceLandmarks: null,
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

  // Initialize TensorFlow Face Detection
  useEffect(() => {
    const initFaceDetection = async () => {
      try {
        setIsLoading(true);
        const detectorConfig = {
          runtime: 'mediapipe',
          solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm',
        };
        const model = await faceDetection.createDetector(
          faceDetection.SupportedModels.MediaPipeFacetsDetector,
          detectorConfig
        );
        setDetector(model);
        setError(null);
      } catch (err) {
        console.error('Failed to load face detection model:', err);
        setError('Failed to load face detection model. Please try again.');
        toast.error('Failed to initialize face detection');
      } finally {
        setIsLoading(false);
      }
    };

    initFaceDetection();
  }, []);

  // Access webcam
  useEffect(() => {
    if (!detector) return;

    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Camera access denied:', err);
        setError('Camera access is required for verification');
        toast.error('Camera access denied');
      }
    };

    setupCamera();
  }, [detector]);

  // Calculate 3D head pose from face landmarks
  const estimateHeadPose = (landmarks, imageWidth, imageHeight) => {
    if (!landmarks || landmarks.length < 468) {
      return { pitch: 0, yaw: 0, roll: 0 };
    }

    // Key landmark indices
    const noseTip = landmarks[1]; // Nose tip
    const rightEye = landmarks[33]; // Right eye outer corner
    const leftEye = landmarks[263]; // Left eye outer corner
    const chin = landmarks[152]; // Chin
    const foreheadPoint = landmarks[10]; // Forehead
    const mouthRight = landmarks[61]; // Mouth right
    const mouthLeft = landmarks[291]; // Mouth left

    // Calculate angles
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
    const foreheadToChin = chin.y - foreheadPoint.y;
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

  // Calculate mouth openness ratio
  const calculateMouthOpenness = (landmarks) => {
    if (!landmarks || landmarks.length < 468) return 0;

    // Mouth landmarks
    const upperLip = landmarks[13]; // Upper lip center
    const lowerLip = landmarks[14]; // Lower lip center
    const mouthWidth =
      Math.hypot(landmarks[61].x - landmarks[291].x, landmarks[61].y - landmarks[291].y) || 1;
    const mouthHeight = Math.hypot(
      upperLip.x - lowerLip.x,
      upperLip.y - lowerLip.y
    );

    return Math.min(1, mouthHeight / mouthWidth);
  };

  // Calculate eye openness ratio
  const calculateEyeOpenness = (landmarks, eyeSide) => {
    if (!landmarks || landmarks.length < 468) return 1;

    let eyelidTop, eyelidBottom, eyeInner, eyeOuter;

    if (eyeSide === 'left') {
      eyelidTop = landmarks[386]; // Left eye upper eyelid
      eyelidBottom = landmarks[374]; // Left eye lower eyelid
      eyeInner = landmarks[362]; // Left eye inner corner
      eyeOuter = landmarks[263]; // Left eye outer corner
    } else {
      eyelidTop = landmarks[159]; // Right eye upper eyelid
      eyelidBottom = landmarks[145]; // Right eye lower eyelid
      eyeInner = landmarks[33]; // Right eye inner corner
      eyeOuter = landmarks[133]; // Right eye outer corner
    }

    const eyeWidth = Math.hypot(eyeOuter.x - eyeInner.x, eyeOuter.y - eyeInner.y) || 1;
    const eyeHeight = Math.hypot(eyelidTop.x - eyelidBottom.x, eyelidTop.y - eyelidBottom.y);

    return Math.min(1, eyeHeight / eyeWidth);
  };

  // Detect blink event
  const detectBlink = (eyeOpenness) => {
    const state = analysisStateRef.current;
    const threshold = 0.2;

    // Eye closed
    if (eyeOpenness < threshold) {
      if (!state.blinkInProgress) {
        state.blinkInProgress = true;
        state.eyeClosureStart = Date.now();
      }
    }
    // Eye opened
    else if (state.blinkInProgress && state.eyeClosureStart) {
      const closureDuration = Date.now() - state.eyeClosureStart;

      // Valid blink: 150-250ms
      if (closureDuration >= 150 && closureDuration <= 250) {
        state.blinkInProgress = false;
        state.eyeClosureStart = null;
        return true;
      }

      // Too long or too short, reset
      if (closureDuration > 250) {
        state.blinkInProgress = false;
        state.eyeClosureStart = null;
      }
    }

    return false;
  };

  // Check if movement threshold is met
  const checkMovementThreshold = (movementId, pose, eyeOpenness, mouthOpenness) => {
    const movement = MOVEMENTS[movementId];

    switch (movementId) {
      case 0: // Turn right
        return pose.yaw > movement.threshold;
      case 1: // Turn left
        return pose.yaw < movement.threshold;
      case 2: // Blink
        return detectBlink(Math.min(eyeOpenness[0], eyeOpenness[1]));
      case 3: // Open mouth
        return mouthOpenness > movement.threshold;
      default:
        return false;
    }
  };

  // Draw face landmarks and analysis info on canvas
  const drawAnalysis = (landmarks, pose, eyeOpenness, mouthOpenness, ctx, imageWidth, imageHeight) => {
    ctx.clearRect(0, 0, imageWidth, imageHeight);

    // Draw face landmarks
    if (landmarks) {
      ctx.fillStyle = '#0a66c2';
      landmarks.forEach((landmark) => {
        if (landmark.x >= 0 && landmark.x <= imageWidth && landmark.y >= 0 && landmark.y <= imageHeight) {
          ctx.beginPath();
          ctx.arc(landmark.x, landmark.y, 2, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
    }

    // Draw head pose indicators
    const centerX = imageWidth / 2;
    const centerY = imageHeight / 2;
    const arrowLength = 50;

    // Draw yaw angle (left/right)
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos((pose.yaw * Math.PI) / 180) * arrowLength,
      centerY + Math.sin((pose.yaw * Math.PI) / 180) * arrowLength
    );
    ctx.stroke();

    // Draw current movement instructions and info
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.strokeStyle = '#0a66c2';
    ctx.lineWidth = 4;

    const currentMov = MOVEMENTS[currentMovement];
    ctx.strokeText(currentMov.instruction, 20, 50);
    ctx.fillText(currentMov.instruction, 20, 50);

    // Display analytics
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;

    const analytics = [
      `Head Yaw: ${pose.yaw}°`,
      `Mouth: ${(mouthOpenness * 100).toFixed(0)}%`,
      `Eyes: L=${(eyeOpenness[0] * 100).toFixed(0)}% R=${(eyeOpenness[1] * 100).toFixed(0)}%`,
    ];

    analytics.forEach((text, idx) => {
      const y = imageHeight - 50 + idx * 25;
      ctx.strokeText(text, 20, y);
      ctx.fillText(text, 20, y);
    });
  };

  // Main analysis loop - runs at 25-30 FPS with requestAnimationFrame
  const analyzeFrame = async () => {
    if (!detector || !videoRef.current || videoRef.current.readyState !== 4) {
      requestAnimationFrame(analyzeFrame);
      return;
    }

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Run face detection
      const predictions = await detector.estimateFaces(video, false);

      if (!predictions.length) {
        requestAnimationFrame(analyzeFrame);
        return;
      }

      const face = predictions[0];
      const keypoints = face.keypoints;
      const imageWidth = video.videoWidth;
      const imageHeight = video.videoHeight;

      // Set canvas dimensions
      canvas.width = imageWidth;
      canvas.height = imageHeight;
      const ctx = canvas.getContext('2d');

      // Calculate metrics
      const pose = estimateHeadPose(keypoints, imageWidth, imageHeight);
      const eyeOpenness = [
        calculateEyeOpenness(keypoints, 'left'),
        calculateEyeOpenness(keypoints, 'right'),
      ];
      const mouthOpenness = calculateMouthOpenness(keypoints);

      // Update analysis state
      const state = analysisStateRef.current;
      state.headRotation = pose;
      state.eyeOpenness = eyeOpenness;
      state.mouthOpenness = mouthOpenness;
      state.faceLandmarks = keypoints;

      // Draw analysis on canvas
      drawAnalysis(keypoints, pose, eyeOpenness, mouthOpenness, ctx, imageWidth, imageHeight);

      // Check if current movement threshold is met
      if (checkMovementThreshold(currentMovement, pose, eyeOpenness, mouthOpenness)) {
        setMovementProgress((prev) => {
          const updated = { ...prev };
          updated[currentMovement] = true;

          // Move to next movement or capture if all complete
          if (currentMovement < 3) {
            setCurrentMovement(currentMovement + 1);
            toast.success(`✓ ${MOVEMENTS[currentMovement].label} detected!`);
          } else {
            // All movements complete - capture and submit
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

  // Capture frame and submit
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
      console.error('Capture error:', err);
      toast.error('Failed to capture image');
    }
  };

  // Start analysis loop when detector is ready
  useEffect(() => {
    if (detector && videoRef.current) {
      const videoElement = videoRef.current;
      videoElement.onloadedmetadata = () => {
        requestAnimationFrame(analyzeFrame);
      };
    }
  }, [detector, currentMovement]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#0a66c2] border-t-transparent mb-4" />
        <p className="text-gray-600 font-semibold">Initializing biometric system...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <AlertCircle className="w-12 h-12 text-red-600" />
        <p className="text-red-600 font-semibold">{error}</p>
        <button
          onClick={onBack}
          className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Video Feed */}
      <div className="relative">
        <div className="relative bg-black rounded-xl overflow-hidden w-full" style={{ aspectRatio: '4/3' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ transform: 'scaleX(-1)' }}
          />
        </div>

        {/* Overlay Instructions */}
        <div className="absolute top-4 left-4 right-4">
          <div className="bg-[#0a66c2] text-white rounded-lg p-3 text-center">
            <p className="text-sm font-semibold">{MOVEMENTS[currentMovement].instruction}</p>
            <p className="text-xs text-blue-100 mt-1">{MOVEMENTS[currentMovement].label}</p>
          </div>
        </div>
      </div>

      {/* Progress Tracker */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-900">Verification Progress</p>
        <div className="grid grid-cols-4 gap-2">
          {MOVEMENTS.map((movement) => (
            <div
              key={movement.id}
              className={`p-3 rounded-lg text-center transition ${
                movementProgress[movement.id]
                  ? 'bg-green-100 border-2 border-green-500'
                  : currentMovement === movement.id
                  ? 'bg-blue-100 border-2 border-[#0a66c2]'
                  : 'bg-gray-100 border-2 border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">
                {movementProgress[movement.id] ? '✓' : movement.id === 0 ? '→' : movement.id === 1 ? '←' : movement.id === 2 ? '👁' : '👄'}
              </div>
              <p className="text-xs font-semibold text-gray-700">{movement.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
        <p className="text-sm font-semibold text-blue-900">📋 Complete all movements in order:</p>
        <ul className="text-xs text-blue-800 space-y-1 ml-4">
          <li>✓ Turn your head to the right ({">"} 15°)</li>
          <li>✓ Turn your head to the left ({"<"} -15°)</li>
          <li>✓ Blink your eyes (150-250ms)</li>
          <li>✓ Open your mouth (30%+ gap)</li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 border-2 border-gray-300 text-gray-700 font-semibold rounded-full py-3 hover:bg-gray-100 transition flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={captureAndSubmit}
          disabled={currentMovement < 3 || !movementProgress[3]}
          className="flex-1 bg-gradient-to-r from-[#0a66c2] to-[#005ba1] hover:shadow-lg disabled:opacity-50 text-white font-semibold rounded-full py-3 flex items-center justify-center gap-2 transition"
        >
          <Camera className="w-4 h-4" />
          Capture Now
        </button>
      </div>

      {/* Loading State */}
      {!detector && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-xl">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent mb-2" />
            <p className="text-white text-sm">Initializing...</p>
          </div>
        </div>
      )}
    </div>
  );
}
