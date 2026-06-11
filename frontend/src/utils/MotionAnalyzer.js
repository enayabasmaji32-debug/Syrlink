/**
 * Motion Analyzer
 * Tracks frame-to-frame motion and detects liveness
 */

class MotionAnalyzer {
  constructor(windowSize = 30) {
    this.windowSize = windowSize;
    this.motionHistory = [];
    this.poseHistory = [];
    this.landmarkHistory = [];
  }

  /**
   * Record motion metrics for current frame
   */
  recordFrame(landmarks, pose, faceBox) {
    this.landmarkHistory.push({
      timestamp: Date.now(),
      landmarks: JSON.parse(JSON.stringify(landmarks)),
    });

    this.poseHistory.push({
      timestamp: Date.now(),
      pose: JSON.parse(JSON.stringify(pose)),
    });

    // Keep only last N frames
    if (this.landmarkHistory.length > this.windowSize) {
      this.landmarkHistory.shift();
    }
    if (this.poseHistory.length > this.windowSize) {
      this.poseHistory.shift();
    }
  }

  /**
   * Calculate motion between two frames
   */
  calculateMotion(landmarks1, landmarks2) {
    if (!landmarks1 || !landmarks2) return 0;

    let totalDistance = 0;
    let pointCount = 0;

    for (const key in landmarks1) {
      if (landmarks2[key]) {
        const dx = landmarks2[key].x - landmarks1[key].x;
        const dy = landmarks2[key].y - landmarks1[key].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        totalDistance += distance;
        pointCount++;
      }
    }

    return pointCount > 0 ? totalDistance / pointCount : 0;
  }

  /**
   * Detect if face is static (not moving)
   */
  isStatic(threshold = 5) {
    if (this.landmarkHistory.length < 5) return true;

    // Check last 5 frames
    let staticFrames = 0;
    for (let i = Math.max(0, this.landmarkHistory.length - 5); i < this.landmarkHistory.length - 1; i++) {
      const motion = this.calculateMotion(
        this.landmarkHistory[i].landmarks,
        this.landmarkHistory[i + 1].landmarks
      );

      if (motion < threshold) {
        staticFrames++;
      }
    }

    // If 4+ out of 5 frames are static, face is static
    return staticFrames >= 4;
  }

  /**
   * Calculate blink detection from eye landmarks
   */
  detectBlink(landmarks, threshold = 0.2, durationMs = 150) {
    if (!landmarks.eyeLeft || !landmarks.eyeRight) return false;

    const eyeLeftHeight = Math.abs(
      (landmarks.eyeLeft.y || 0) - (landmarks.eyeLeft.y || 0)
    );
    const eyeRightHeight = Math.abs(
      (landmarks.eyeRight.y || 0) - (landmarks.eyeRight.y || 0)
    );

    const avgHeight = (eyeLeftHeight + eyeRightHeight) / 2;

    // Simple threshold check
    return avgHeight < threshold;
  }

  /**
   * Calculate mouth opening ratio
   */
  calculateMouthOpenness(landmarks) {
    if (!landmarks.mouthCenter) return 0;

    // Simplified mouth detection
    // In real implementation, would track upper and lower lip
    const mouthHeight = (landmarks.chin?.y || 0) - (landmarks.mouthCenter?.y || 0);

    return Math.max(0, Math.min(1, mouthHeight / 50));
  }

  /**
   * Detect natural micro-movements
   */
  hasMicroMovements() {
    if (this.poseHistory.length < 10) return false;

    // Check if yaw varies naturally (not static)
    const yaws = this.poseHistory.slice(-10).map(p => p.pose.yaw);
    const yawVariance = this.calculateVariance(yaws);

    // Check if pitch varies naturally
    const pitches = this.poseHistory.slice(-10).map(p => p.pose.pitch);
    const pitchVariance = this.calculateVariance(pitches);

    // Natural micro-movements have small but non-zero variance
    return yawVariance > 0.1 && yawVariance < 100 &&
           pitchVariance > 0.1 && pitchVariance < 100;
  }

  /**
   * Calculate variance of array
   */
  calculateVariance(arr) {
    if (arr.length < 2) return 0;

    const mean = arr.reduce((a, b) => a + b) / arr.length;
    const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2)) / arr.length;

    return variance;
  }

  /**
   * Calculate depth change (indicates real face vs. flat photo)
   */
  calculateDepthChange() {
    if (this.poseHistory.length < 10) return 0;

    // Check how much facial geometry changes
    // Real face geometry changes more when head rotates
    const poseChanges = [];

    for (let i = 1; i < Math.min(10, this.poseHistory.length); i++) {
      const prev = this.poseHistory[i - 1].pose;
      const curr = this.poseHistory[i].pose;

      const yawChange = Math.abs(curr.yaw - prev.yaw);
      const pitchChange = Math.abs(curr.pitch - prev.pitch);
      const rollChange = Math.abs(curr.roll - prev.roll);

      poseChanges.push(yawChange + pitchChange + rollChange);
    }

    return poseChanges.length > 0 ?
      poseChanges.reduce((a, b) => a + b) / poseChanges.length :
      0;
  }

  /**
   * Analyze blink pattern (should blink naturally)
   */
  analyzeBlinks(landmarks) {
    // Track blink timestamps
    if (!this.blinkHistory) {
      this.blinkHistory = [];
    }

    const isBlink = this.detectBlink(landmarks);

    if (isBlink && (!this.lastBlink || Date.now() - this.lastBlink > 200)) {
      this.blinkHistory.push(Date.now());
      this.lastBlink = Date.now();

      // Keep only last 60 seconds of blinks
      this.blinkHistory = this.blinkHistory.filter(
        t => Date.now() - t < 60000
      );
    }

    // Calculate blink rate (blinks per minute)
    const blinkRate = (this.blinkHistory.length / 60) * 1000;

    // Natural blink rate: 15-30 blinks per minute
    return {
      count: this.blinkHistory.length,
      rate: blinkRate,
      isNatural: blinkRate >= 10 && blinkRate <= 40,
    };
  }

  /**
   * Overall liveness score based on motion analysis
   */
  calculateLivenessScore() {
    let score = 0;

    // Check 1: Is face moving (not static)
    if (!this.isStatic()) {
      score += 20;
    }

    // Check 2: Has micro-movements
    if (this.hasMicroMovements()) {
      score += 20;
    }

    // Check 3: Has depth change (indicates 3D)
    const depthChange = this.calculateDepthChange();
    if (depthChange > 2) {
      score += 20;
    }

    // Check 4: Adequate blink pattern
    if (this.blinkHistory && this.blinkHistory.length > 0) {
      score += 20;
    }

    // Check 5: History length (must have observed for a while)
    if (this.poseHistory.length >= 10) {
      score += 20;
    }

    return Math.min(100, score);
  }

  /**
   * Reset history
   */
  reset() {
    this.motionHistory = [];
    this.poseHistory = [];
    this.landmarkHistory = [];
    this.blinkHistory = [];
  }
}

export default MotionAnalyzer;
