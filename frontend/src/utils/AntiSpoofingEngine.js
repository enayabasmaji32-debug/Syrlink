/**
 * Anti-Spoofing Engine
 * Detects printed photos, screen replays, and static images
 * Rules-based, no AI models
 */

class AntiSpoofingEngine {
  constructor() {
    this.frameHistory = [];
    this.lightingHistory = [];
    this.edgeHistory = [];
  }

  /**
   * Detect printed photo based on edge analysis
   * Printed photos have stable edges that don't change with head movement
   */
  detectPrintedPhoto(edges, prevEdges) {
    if (!prevEdges) return false;

    // Compare edge stability
    let unchangedEdges = 0;
    let totalEdges = 0;

    for (let i = 0; i < Math.min(edges.length, prevEdges.length); i++) {
      if (edges[i] > 0) {
        totalEdges++;
        if (Math.abs(edges[i] - (prevEdges[i] || 0)) < 5) {
          unchangedEdges++;
        }
      }
    }

    // If >85% of edges are unchanged, likely printed photo
    const edgeStability = totalEdges > 0 ? unchangedEdges / totalEdges : 0;

    this.edgeHistory.push(edgeStability);
    if (this.edgeHistory.length > 10) {
      this.edgeHistory.shift();
    }

    return edgeStability > 0.85;
  }

  /**
   * Detect screen replay based on pixel patterns
   * Screens have regular pixel grids and moiré patterns
   */
  detectScreenReplay(imageData) {
    const data = imageData.data;
    const width = imageWidth;

    let moireDetections = 0;
    let samples = 0;

    // Sample rows and look for regular patterns
    for (let y = 10; y < imageData.height - 10; y += 5) {
      let patternRepeat = 0;

      for (let x = 10; x < width - 10; x += 2) {
        const idx = (y * width + x) * 4;
        const nextIdx = (y * width + x + 2) * 4;

        // Check if pixels repeat in a pattern
        const diff = Math.abs(data[idx] - data[nextIdx]);
        if (diff < 5) {
          patternRepeat++;
        }
      }

      samples++;
      if (patternRepeat > (width - 20) / 2 * 0.7) {
        moireDetections++;
      }
    }

    // If many rows show regular patterns, likely screen
    return moireDetections > samples * 0.6;
  }

  /**
   * Analyze lighting and shadow changes
   * Real faces show natural light/shadow variation when moving
   * Printed photos and screens show less variation
   */
  analyzeLighting(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Sample brightness in face regions
    const faceRegionStart = Math.floor(height * 0.2);
    const faceRegionEnd = Math.floor(height * 0.8);

    let totalBrightness = 0;
    let sampleCount = 0;

    for (let y = faceRegionStart; y < faceRegionEnd; y += 5) {
      for (let x = Math.floor(width * 0.2); x < width * 0.8; x += 5) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Calculate luminosity
        const brightness = r * 0.299 + g * 0.587 + b * 0.114;
        totalBrightness += brightness;
        sampleCount++;
      }
    }

    const avgBrightness = sampleCount > 0 ? totalBrightness / sampleCount : 128;

    this.lightingHistory.push(avgBrightness);
    if (this.lightingHistory.length > 15) {
      this.lightingHistory.shift();
    }

    return {
      brightness: avgBrightness,
      variance: this.calculateVariance(this.lightingHistory),
    };
  }

  /**
   * Detect if lighting changes naturally with head movement
   * Real faces: lighting changes when head rotates
   * Photos/screens: minimal lighting change
   */
  detectLightingConsistency(pose, lighting) {
    if (this.poseHistory?.length < 10) return true; // Not enough data

    // If head rotates significantly but lighting barely changes, suspect
    const recentPoses = this.poseHistory.slice(-10);
    const yawRange = Math.max(...recentPoses.map(p => p.yaw)) -
                      Math.min(...recentPoses.map(p => p.yaw));

    const lightingVariance = this.lightingHistory?.slice(-10) ?
      this.calculateVariance(this.lightingHistory.slice(-10)) :
      0;

    // If head rotates >20 degrees but lighting barely changes, suspect
    if (yawRange > 20 && lightingVariance < 10) {
      return false; // Likely fake
    }

    return true; // Lighting seems natural
  }

  /**
   * Detect face shape change (depth perception)
   * Real faces: shape changes when rotating head
   * Photos: minimal shape change
   */
  detectFaceShapeChange(landmarks, prevLandmarks) {
    if (!prevLandmarks) return false;

    // Calculate face width and height
    const width = Math.abs(landmarks.eyeRight.x - landmarks.eyeLeft.x);
    const height = Math.abs(landmarks.chin.y - landmarks.eyeLeft.y);
    const prevWidth = Math.abs(prevLandmarks.eyeRight.x - prevLandmarks.eyeLeft.x);
    const prevHeight = Math.abs(prevLandmarks.chin.y - prevLandmarks.eyeLeft.y);

    // Calculate change ratio
    const widthChange = Math.abs(width - prevWidth) / prevWidth;
    const heightChange = Math.abs(height - prevHeight) / prevHeight;

    // Real faces show some shape change with movement
    const shapeChange = (widthChange + heightChange) / 2;

    return shapeChange > 0.02; // At least 2% change
  }

  /**
   * Calculate texture quality
   * Real faces have natural texture variations
   * Photos/screens have smooth, repetitive textures
   */
  analyzeTextureQuality(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Sample texture variance in face region
    let pixelDifferences = 0;
    let samples = 0;

    for (let y = Math.floor(height * 0.3); y < height * 0.7; y += 5) {
      for (let x = Math.floor(width * 0.3); x < width * 0.7; x += 5) {
        const idx = (y * width + x) * 4;
        const nextIdx = (y * width + x + 1) * 4;

        if (nextIdx < data.length) {
          const r1 = data[idx];
          const g1 = data[idx + 1];
          const b1 = data[idx + 2];
          const r2 = data[nextIdx];
          const g2 = data[nextIdx + 1];
          const b2 = data[nextIdx + 2];

          const diff = Math.sqrt(
            (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2
          );
          pixelDifferences += diff;
          samples++;
        }
      }
    }

    const avgTextureDiff = samples > 0 ? pixelDifferences / samples : 0;

    // Real skin has moderate texture variation
    // Printed/screen: too smooth (< 5) or too noisy (> 50)
    return {
      quality: avgTextureDiff,
      isNatural: avgTextureDiff > 5 && avgTextureDiff < 50,
    };
  }

  /**
   * Overall spoofing detection
   */
  detectSpoofing(imageData, landmarks, pose, edges = null, prevEdges = null) {
    const checks = {
      printedPhoto: false,
      screenReplay: false,
      flatImage: false,
      unnaturalLighting: false,
    };

    // Check 1: Printed photo detection
    if (prevEdges && edges) {
      checks.printedPhoto = this.detectPrintedPhoto(edges, prevEdges);
    }

    // Check 2: Screen replay detection
    checks.screenReplay = this.detectScreenReplay(imageData);

    // Check 3: Face shape change (detect flat images)
    if (this.prevLandmarks) {
      checks.flatImage = !this.detectFaceShapeChange(landmarks, this.prevLandmarks);
    }
    this.prevLandmarks = landmarks;

    // Check 4: Lighting analysis
    const lighting = this.analyzeLighting(imageData);
    if (this.poseHistory && this.poseHistory.length > 0) {
      checks.unnaturalLighting = !this.detectLightingConsistency(pose, lighting);
    }

    this.poseHistory ??= [];
    this.poseHistory.push(pose);
    if (this.poseHistory.length > 20) {
      this.poseHistory.shift();
    }

    // Calculate spoofing probability
    const spoofingScore = Object.values(checks).filter(Boolean).length / 4;

    return {
      isSpoofed: spoofingScore > 0.5,
      spoofingScore: Math.round(spoofingScore * 100),
      checks,
    };
  }

  /**
   * Helper: Calculate variance
   */
  calculateVariance(arr) {
    if (arr.length < 2) return 0;

    const mean = arr.reduce((a, b) => a + b) / arr.length;
    const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2)) / arr.length;

    return variance;
  }

  /**
   * Reset history
   */
  reset() {
    this.frameHistory = [];
    this.lightingHistory = [];
    this.edgeHistory = [];
    this.poseHistory = [];
    this.prevLandmarks = null;
  }
}

export default AntiSpoofingEngine;
