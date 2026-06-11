/**
 * Classic Face Detection Engine
 * Uses edge detection and contour analysis
 * No AI models, no external APIs
 */

class FaceDetectionEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.imageData = null;
    this.grayscale = null;
    this.edges = null;
  }

  /**
   * Convert image to grayscale using luminosity method
   */
  toGrayscale(imageData) {
    const data = imageData.data;
    const gray = new Uint8Array(imageData.width * imageData.height);
    
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      // Standard luminosity formula
      gray[j] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    }
    
    this.grayscale = gray;
    return gray;
  }

  /**
   * Sobel edge detection
   */
  sobelEdges(gray, width, height) {
    const edges = new Uint8Array(width * height);
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            const kernel_idx = (ky + 1) * 3 + (kx + 1);
            gx += gray[idx] * sobelX[kernel_idx];
            gy += gray[idx] * sobelY[kernel_idx];
          }
        }

        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[y * width + x] = Math.min(255, magnitude);
      }
    }

    this.edges = edges;
    return edges;
  }

  /**
   * Detect skin color regions (simple RGB-based)
   */
  detectSkinRegions(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const skin = new Uint8Array(width * height);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Simple skin color detection in RGB
      // Skin pixels typically have R > G > B
      // and R > 95, G > 40, B > 20
      if (r > 95 && g > 40 && b > 20 &&
          r > g && g > b &&
          r - g > 15) {
        skin[i / 4] = 255;
      } else {
        skin[i / 4] = 0;
      }
    }

    return skin;
  }

  /**
   * Find contours in binary image using boundary tracing
   */
  findContours(binaryImage, width, height, minSize = 100) {
    const contours = [];
    const visited = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        
        if (binaryImage[idx] > 128 && !visited[idx]) {
          const contour = this.traceContour(binaryImage, visited, x, y, width, height);
          
          if (contour.length > minSize) {
            contours.push(contour);
          }
        }
      }
    }

    return contours;
  }

  /**
   * Trace a contour using simple boundary following
   */
  traceContour(binary, visited, startX, startY, width, height) {
    const contour = [];
    const directions = [
      [1, 0], [1, 1], [0, 1], [-1, 1],
      [-1, 0], [-1, -1], [0, -1], [1, -1],
    ];

    let x = startX, y = startY;
    let dirIdx = 0;

    do {
      visited[y * width + x] = 1;
      contour.push({ x, y });

      let found = false;
      for (let i = 0; i < 8; i++) {
        const nextDir = (dirIdx + i) % 8;
        const [dx, dy] = directions[nextDir];
        const nx = x + dx, ny = y + dy;

        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          if (binary[nIdx] > 128 && !visited[nIdx]) {
            x = nx;
            y = ny;
            dirIdx = nextDir;
            found = true;
            break;
          }
        }
      }

      if (!found) break;
    } while (contour.length < 10000);

    return contour;
  }

  /**
   * Calculate bounding box from contour
   */
  boundingBoxFromContour(contour) {
    if (contour.length === 0) return null;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    contour.forEach(point => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    });

    const width = maxX - minX;
    const height = maxY - minY;
    const aspectRatio = width / height;

    // Face aspect ratio typically 0.7-1.2
    if (aspectRatio < 0.6 || aspectRatio > 1.3) {
      return null;
    }

    // Face area should be reasonable
    const area = width * height;
    if (area < 1000) return null;

    return {
      x: minX,
      y: minY,
      width,
      height,
      area,
      aspectRatio,
    };
  }

  /**
   * Detect face in frame
   */
  detectFace(frame) {
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

    const gray = this.toGrayscale(imageData);
    const edges = this.sobelEdges(gray, imageData.width, imageData.height);

    // Threshold edges
    const edgesBinary = new Uint8Array(edges.length);
    for (let i = 0; i < edges.length; i++) {
      edgesBinary[i] = edges[i] > 50 ? 255 : 0;
    }

    const skin = this.detectSkinRegions(imageData);

    // Combine edges and skin
    const combined = new Uint8Array(edges.length);
    for (let i = 0; i < combined.length; i++) {
      combined[i] = (skin[i] > 128 && edgesBinary[i] > 128) ? 255 : 0;
    }

    const contours = this.findContours(combined, imageData.width, imageData.height);
    const faces = contours
      .map(contour => this.boundingBoxFromContour(contour))
      .filter(bbox => bbox !== null);

    if (faces.length === 0) return null;

    return faces.reduce((best, current) =>
      current.area > best.area ? current : best
    );
  }

  /**
   * Estimate key feature points from face bounding box
   */
  estimateKeyPoints(faceBBox) {
    const { x, y, width, height } = faceBBox;

    return {
      eyeLeft: { x: x + width * 0.35, y: y + height * 0.35 },
      eyeRight: { x: x + width * 0.65, y: y + height * 0.35 },
      noseTip: { x: x + width * 0.5, y: y + height * 0.5 },
      mouthCenter: { x: x + width * 0.5, y: y + height * 0.7 },
      chin: { x: x + width * 0.5, y: y + height * 0.85 },
      faceCenter: { x: x + width * 0.5, y: y + height * 0.5 },
    };
  }
}

export default FaceDetectionEngine;
