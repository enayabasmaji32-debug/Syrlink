/**
 * Head Pose Estimator
 * Calculates yaw, pitch, roll using pure geometric math
 * No AI models required
 */

class HeadPoseEstimator {
  constructor() {
    // 3D reference model of human head (simplified)
    // Points in 3D space (relative units)
    this.headModel3D = {
      eyeLeft: { x: -50, y: 30, z: 0 },
      eyeRight: { x: 50, y: 30, z: 0 },
      noseTip: { x: 0, y: -30, z: 80 },
      mouthCenter: { x: 0, y: -50, z: -10 },
      chin: { x: 0, y: -80, z: -30 },
      faceCenter: { x: 0, y: 0, z: 0 },
    };
  }

  /**
   * Calculate head pose from 2D image points
   * Using geometric relationships and basic trigonometry
   */
  estimatePose(keyPoints, imageWidth, imageHeight) {
    const { eyeLeft, eyeRight, noseTip, mouthCenter, chin, faceCenter } = keyPoints;

    // Normalize points (0-1)
    const eyeLeftNorm = { x: eyeLeft.x / imageWidth, y: eyeLeft.y / imageHeight };
    const eyeRightNorm = { x: eyeRight.x / imageWidth, y: eyeRight.y / imageHeight };
    const noseTipNorm = { x: noseTip.x / imageWidth, y: noseTip.y / imageHeight };
    const chinNorm = { x: chin.x / imageWidth, y: chin.y / imageHeight };

    // Calculate YAW (left/right rotation)
    const yaw = this.calculateYaw(eyeLeftNorm, eyeRightNorm, noseTipNorm);

    // Calculate PITCH (up/down rotation)
    const pitch = this.calculatePitch(noseTipNorm, chinNorm, eyeLeftNorm, eyeRightNorm);

    // Calculate ROLL (tilt rotation)
    const roll = this.calculateRoll(eyeLeftNorm, eyeRightNorm);

    return {
      yaw: Math.round(yaw),
      pitch: Math.round(pitch),
      roll: Math.round(roll),
      confidence: this.calculateConfidence(keyPoints),
    };
  }

  /**
   * Calculate YAW angle (left/right head rotation)
   * Based on nose position relative to eyes
   */
  calculateYaw(eyeLeft, eyeRight, noseTip) {
    // Eye center
    const eyeCenter = {
      x: (eyeLeft.x + eyeRight.x) / 2,
    };

    // Distance from nose to eye center (normalized)
    const noseDeviation = (noseTip.x - eyeCenter.x) * 100;

    // Convert to degrees (-90 to +90)
    // Positive = looking right, Negative = looking left
    const yaw = noseDeviation * 90;

    // Clamp to reasonable range
    return Math.max(-90, Math.min(90, yaw));
  }

  /**
   * Calculate PITCH angle (up/down head rotation)
   * Based on nose and chin vertical positions
   */
  calculatePitch(noseTip, chin, eyeLeft, eyeRight) {
    // Eye baseline
    const eyeCenter = {
      y: (eyeLeft.y + eyeRight.y) / 2,
    };

    // Vertical distances
    const noseToEye = noseTip.y - eyeCenter.y;
    const chinToNose = chin.y - noseTip.y;

    // Pitch calculation
    // Positive = looking up, Negative = looking down
    const pitch = (noseToEye - chinToNose) * 90;

    return Math.max(-45, Math.min(45, pitch));
  }

  /**
   * Calculate ROLL angle (head tilt)
   * Based on eye-to-eye angle
   */
  calculateRoll(eyeLeft, eyeRight) {
    // Calculate eye line angle
    const deltaY = eyeRight.y - eyeLeft.y;
    const deltaX = eyeRight.x - eyeLeft.x;

    // Angle in radians, convert to degrees
    const roll = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    return Math.max(-45, Math.min(45, roll));
  }

  /**
   * Calculate confidence of pose estimation
   * Based on typical face geometry
   */
  calculateConfidence(keyPoints) {
    const { eyeLeft, eyeRight, noseTip, chin } = keyPoints;

    // Check if points form reasonable geometry
    const eyeDistance = Math.hypot(eyeRight.x - eyeLeft.x, eyeRight.y - eyeLeft.y);
    const noseToEyeDistance = Math.hypot(
      noseTip.x - (eyeLeft.x + eyeRight.x) / 2,
      noseTip.y - (eyeLeft.y + eyeRight.y) / 2
    );
    const facialHeight = Math.hypot(chin.x - eyeLeft.x, chin.y - eyeLeft.y);

    // Reasonable ratios
    const eyeToFaceRatio = eyeDistance / facialHeight;
    const noseToEyeRatio = noseToEyeDistance / eyeDistance;

    // Check if ratios are reasonable (for human face)
    let confidence = 1.0;

    if (eyeToFaceRatio < 0.3 || eyeToFaceRatio > 0.6) confidence *= 0.7;
    if (noseToEyeRatio < 0.3 || noseToEyeRatio > 1.0) confidence *= 0.7;

    return confidence;
  }

  /**
   * Smooth pose using exponential moving average
   * Helps reduce jitter
   */
  smoothPose(currentPose, previousPose, alpha = 0.6) {
    if (!previousPose) return currentPose;

    return {
      yaw: previousPose.yaw * alpha + currentPose.yaw * (1 - alpha),
      pitch: previousPose.pitch * alpha + currentPose.pitch * (1 - alpha),
      roll: previousPose.roll * alpha + currentPose.roll * (1 - alpha),
      confidence: Math.max(previousPose.confidence, currentPose.confidence),
    };
  }

  /**
   * Check if head rotation matches a target direction
   */
  checkHeadRotation(pose, direction, threshold) {
    switch (direction) {
      case 'right':
        return pose.yaw > threshold;
      case 'left':
        return pose.yaw < -threshold;
      case 'up':
        return pose.pitch > threshold;
      case 'down':
        return pose.pitch < -threshold;
      default:
        return false;
    }
  }
}

export default HeadPoseEstimator;
