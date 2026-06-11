/**
 * Liveness Rules Engine
 * Defines and tracks active liveness challenges
 */

class LivenessRulesEngine {
  constructor() {
    this.challenges = [
      {
        id: 'turn_right',
        label: 'Turn Right',
        instruction: 'لف رأسك لليمين',
        direction: 'right',
        threshold: 15,
        completed: false,
        requiredFrames: 5,
        detectedFrames: 0,
      },
      {
        id: 'turn_left',
        label: 'Turn Left',
        instruction: 'لف رأسك لليسار',
        direction: 'left',
        threshold: -15,
        completed: false,
        requiredFrames: 5,
        detectedFrames: 0,
      },
      {
        id: 'look_up',
        label: 'Look Up',
        instruction: 'انظر للأعلى',
        direction: 'up',
        threshold: 10,
        completed: false,
        requiredFrames: 3,
        detectedFrames: 0,
      },
      {
        id: 'open_mouth',
        label: 'Open Mouth',
        instruction: 'افتح فمك',
        direction: 'mouth',
        threshold: 0.3,
        completed: false,
        requiredFrames: 3,
        detectedFrames: 0,
      },
      {
        id: 'blink',
        label: 'Blink',
        instruction: 'ارمش بعينيك',
        direction: 'blink',
        threshold: 0.2,
        completed: false,
        requiredFrames: 1,
        detectedFrames: 0,
      },
    ];

    this.currentChallengeIndex = 0;
    this.startTime = Date.now();
  }

  /**
   * Get current challenge
   */
  getCurrentChallenge() {
    return this.challenges[this.currentChallengeIndex] || null;
  }

  /**
   * Get all challenges with their status
   */
  getAllChallenges() {
    return this.challenges;
  }

  /**
   * Check if challenge is completed
   */
  checkChallenge(pose, mouthOpenness, isBlinking) {
    const challenge = this.getCurrentChallenge();
    if (!challenge) return false;

    let isMet = false;

    switch (challenge.direction) {
      case 'right':
        isMet = pose.yaw > challenge.threshold;
        break;
      case 'left':
        isMet = pose.yaw < challenge.threshold;
        break;
      case 'up':
        isMet = pose.pitch > challenge.threshold;
        break;
      case 'down':
        isMet = pose.pitch < -challenge.threshold;
        break;
      case 'mouth':
        isMet = mouthOpenness > challenge.threshold;
        break;
      case 'blink':
        isMet = isBlinking;
        break;
    }

    if (isMet) {
      challenge.detectedFrames++;

      if (challenge.detectedFrames >= challenge.requiredFrames) {
        challenge.completed = true;
        this.moveToNextChallenge();
        return true;
      }
    } else {
      // Reset if requirement not met
      challenge.detectedFrames = Math.max(0, challenge.detectedFrames - 1);
    }

    return false;
  }

  /**
   * Move to next challenge
   */
  moveToNextChallenge() {
    this.currentChallengeIndex++;
  }

  /**
   * Check if all challenges are completed
   */
  allChallengesCompleted() {
    return this.challenges.every(c => c.completed);
  }

  /**
   * Get progress percentage
   */
  getProgress() {
    const completed = this.challenges.filter(c => c.completed).length;
    return Math.round((completed / this.challenges.length) * 100);
  }

  /**
   * Get current step (0-indexed)
   */
  getCurrentStep() {
    return this.currentChallengeIndex;
  }

  /**
   * Calculate liveness score based on challenge completion
   */
  calculateLivenessScore(motionScore, antiSpoofingScore) {
    const challengeScore = (this.getProgress() / 100) * 40; // 40% for challenges
    const motionComponent = motionScore * 0.3; // 30% for motion
    const antiSpoofingComponent = (100 - antiSpoofingScore) * 0.3; // 30% for anti-spoofing

    return Math.round(challengeScore + motionComponent + antiSpoofingComponent);
  }

  /**
   * Reset all challenges
   */
  reset() {
    this.challenges.forEach(challenge => {
      challenge.completed = false;
      challenge.detectedFrames = 0;
    });
    this.currentChallengeIndex = 0;
    this.startTime = Date.now();
  }

  /**
   * Get elapsed time in seconds
   */
  getElapsedTime() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Check if verification timeout exceeded (e.g., 60 seconds)
   */
  isTimeout(maxSeconds = 60) {
    return this.getElapsedTime() > maxSeconds;
  }
}

export default LivenessRulesEngine;
