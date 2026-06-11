"""
Anti-Spoofing Detection Module - Pure Image Processing
Detects printed photos, screen replays, and other spoofing attempts
Uses only classic image processing and geometric analysis
No AI models, no deep learning
"""

import cv2
import numpy as np
import math
from typing import Dict, Tuple, Optional
from collections import deque


class AntiSpoofingDetector:
    """
    Detects spoofing attempts using image processing and geometric analysis.
    Analyzes: printed images, screen displays, texture patterns, depth consistency.
    """
    
    def __init__(self):
        """Initialize anti-spoofing detector."""
        self.frame_history = deque(maxlen=30)
        self.texture_scores = deque(maxlen=20)
        self.reflection_scores = deque(maxlen=20)
        self.motion_consistency_scores = deque(maxlen=20)
        
    def analyze_frame(self, frame: np.ndarray, 
                     face_bbox: Tuple[int, int, int, int],
                     landmarks_2d: Dict[str, Tuple[float, float]],
                     head_pose: Dict[str, float]) -> Dict[str, any]:
        """
        Analyze frame for spoofing indicators.
        
        Args:
            frame: Input frame (BGR)
            face_bbox: Face bounding box
            landmarks_2d: Face landmarks
            head_pose: Head pose angles
            
        Returns:
            Dictionary with spoofing detection results
        """
        results = {}
        
        # Detect printed photo spoofing
        results['printed_image'] = self._detect_printed_image(frame, face_bbox)
        
        # Detect screen replay spoofing
        results['screen_display'] = self._detect_screen_display(frame, face_bbox)
        
        # Detect texture anomalies
        results['texture_analysis'] = self._analyze_texture(frame, face_bbox)
        
        # Detect reflection patterns
        results['reflection_analysis'] = self._detect_reflections(frame, face_bbox)
        
        # Detect motion-depth inconsistency
        results['motion_depth'] = self._check_motion_depth_consistency(
            face_bbox, head_pose
        )
        
        # Overall spoofing score
        results['spoofing_risk'] = self._calculate_spoofing_risk(results)
        results['is_spoofed'] = results['spoofing_risk'] > 0.6
        
        return results
    
    def _detect_printed_image(self, frame: np.ndarray, 
                             face_bbox: Tuple[int, int, int, int]) -> Dict:
        """
        Detect printed image spoofing by analyzing:
        1. Lack of real depth variation
        2. Static edge patterns
        3. Limited color range
        """
        x, y, w, h = face_bbox
        face_roi = frame[y:y+h, x:x+w]
        
        # Convert to grayscale
        gray = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
        
        # Detect edges
        edges = cv2.Canny(gray, 50, 150)
        edge_density = np.sum(edges > 0) / edges.size
        
        # Detect corners (printed images have corner artifacts)
        corners = cv2.cornerHarris(gray, 2, 3, 0.04)
        corner_count = np.sum(corners > 0.01 * corners.max())
        
        # Analyze color distribution
        # Printed images have more limited color range
        color_range = self._calculate_color_range(face_roi)
        
        # Analyze texture coherence
        # Printed images have more uniform texture
        texture_variance = self._calculate_texture_variance(gray)
        
        # Detect moire patterns (common in screen capture of photos)
        moire_score = self._detect_moire_patterns(gray)
        
        # Scoring
        score = 0.0
        
        # High edge density suggests printing
        if edge_density > 0.15:
            score += 0.3
        
        # Corner artifacts
        corner_density = corner_count / (w * h / 100)
        if corner_density > 0.5:
            score += 0.2
        
        # Limited color range
        if color_range < 50:
            score += 0.2
        
        # Low texture variance
        if texture_variance < 100:
            score += 0.15
        
        # Moire patterns
        score += moire_score * 0.15
        
        return {
            'printed_score': float(np.clip(score, 0, 1)),
            'edge_density': float(edge_density),
            'corner_count': int(corner_count),
            'color_range': float(color_range),
            'texture_variance': float(texture_variance),
            'moire_pattern': float(moire_score),
            'is_printed': score > 0.5
        }
    
    def _detect_screen_display(self, frame: np.ndarray,
                              face_bbox: Tuple[int, int, int, int]) -> Dict:
        """
        Detect screen display spoofing by analyzing:
        1. Regular reflection patterns
        2. Moiré patterns
        3. Pixel grid patterns
        4. Color fringing
        """
        x, y, w, h = face_bbox
        face_roi = frame[y:y+h, x:x+w]
        
        # Convert to grayscale
        gray = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
        
        # Detect regular patterns (pixel grid)
        pattern_score = self._detect_regular_patterns(gray)
        
        # Detect moiré patterns (interference patterns from LCD)
        moire_score = self._detect_moire_patterns(gray)
        
        # Analyze color fringing
        fringing_score = self._detect_color_fringing(face_roi)
        
        # Detect reflection regularities
        reflection_score = self._analyze_reflection_patterns(face_roi)
        
        # Scoring
        score = 0.0
        score += pattern_score * 0.3
        score += moire_score * 0.3
        score += fringing_score * 0.2
        score += reflection_score * 0.2
        
        return {
            'screen_score': float(np.clip(score, 0, 1)),
            'pattern_score': float(pattern_score),
            'moire_score': float(moire_score),
            'fringing_score': float(fringing_score),
            'reflection_score': float(reflection_score),
            'is_screen': score > 0.5
        }
    
    def _analyze_texture(self, frame: np.ndarray,
                        face_bbox: Tuple[int, int, int, int]) -> Dict:
        """Analyze texture properties of face region."""
        x, y, w, h = face_bbox
        face_roi = frame[y:y+h, x:x+w]
        
        gray = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
        
        # Calculate local binary pattern-like features
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        laplacian_var = np.var(laplacian)
        
        # Contrast analysis
        contrast = np.std(gray)
        
        # Texture entropy (measure of randomness)
        hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
        hist = hist.flatten() / hist.sum()
        entropy = -np.sum(hist * np.log(hist + 1e-10))
        
        # Natural face texture has moderate values
        texture_score = 0.0
        
        if 50 < contrast < 80:
            texture_score += 0.5
        
        if 4 < entropy < 7:
            texture_score += 0.5
        
        return {
            'laplacian_variance': float(laplacian_var),
            'contrast': float(contrast),
            'entropy': float(entropy),
            'texture_score': float(texture_score)
        }
    
    def _detect_reflections(self, frame: np.ndarray,
                           face_bbox: Tuple[int, int, int, int]) -> Dict:
        """Detect irregular reflection patterns."""
        x, y, w, h = face_bbox
        
        # Analyze specular highlights
        # Natural reflections are sparse and localized
        # Screen reflections are regular and distributed
        
        # Convert to HSV
        face_roi = frame[y:y+h, x:x+w]
        hsv = cv2.cvtColor(face_roi, cv2.COLOR_BGR2HSV)
        
        # Detect bright regions (potential reflections)
        v_channel = hsv[:, :, 2]
        bright_pixels = np.sum(v_channel > 200) / v_channel.size
        
        # Detect color uniformity in reflections
        # Screen reflections have uniform color
        b, g, r = cv2.split(face_roi)
        
        b_var = np.var(b)
        g_var = np.var(g)
        r_var = np.var(r)
        
        color_uniformity = 1.0 / (1.0 + np.mean([b_var, g_var, r_var]))
        
        # Score
        reflection_score = 0.0
        
        if bright_pixels > 0.1:
            reflection_score += 0.3
        
        if color_uniformity > 0.8:
            reflection_score += 0.3
        
        return {
            'bright_pixels_ratio': float(bright_pixels),
            'color_uniformity': float(color_uniformity),
            'reflection_score': float(np.clip(reflection_score, 0, 1))
        }
    
    def _check_motion_depth_consistency(self, 
                                       face_bbox: Tuple[int, int, int, int],
                                       head_pose: Dict[str, float]) -> Dict:
        """
        Check consistency between head motion and depth changes.
        Spoofing displays won't show proper depth changes when head moves.
        """
        # Store current state
        state = {
            'bbox': face_bbox,
            'pose': head_pose
        }
        self.frame_history.append(state)
        
        if len(self.frame_history) < 5:
            return {'consistency_score': 0.5, 'is_consistent': True}
        
        # Analyze motion-depth relationship
        recent = list(self.frame_history)[-5:]
        
        bbox_sizes = [(bb['bbox'][2] * bb['bbox'][3]) for bb in recent]
        yaw_angles = [bb['pose'].get('yaw', 0) for bb in recent]
        
        # When head turns (yaw changes), face size shouldn't change much
        # But appearance should change (different angles)
        
        yaw_variance = np.var(yaw_angles)
        size_variance = np.var(bbox_sizes)
        
        # Natural motion: some pose change, minimal size change
        # Spoofing: size stays constant despite pose changes
        
        if yaw_variance > 10:  # Head is moving
            # If head moves but size doesn't change much, it's suspicious
            if size_variance < 100:
                consistency_score = 0.3
            else:
                consistency_score = 0.9
        else:
            consistency_score = 0.7
        
        return {
            'consistency_score': float(consistency_score),
            'is_consistent': consistency_score > 0.5,
            'yaw_variance': float(yaw_variance),
            'size_variance': float(size_variance)
        }
    
    def _calculate_color_range(self, roi: np.ndarray) -> float:
        """Calculate range of colors in ROI."""
        b, g, r = cv2.split(roi)
        
        color_range = (np.max(r) - np.min(r) + 
                      np.max(g) - np.min(g) + 
                      np.max(b) - np.min(b)) / 3
        
        return color_range
    
    def _calculate_texture_variance(self, gray: np.ndarray) -> float:
        """Calculate texture variance using local binary patterns."""
        # Simple texture variance using Laplacian
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        return np.var(laplacian)
    
    def _detect_moire_patterns(self, gray: np.ndarray) -> float:
        """Detect moiré patterns from LCD screens."""
        # FFT-based moiré detection
        f_transform = np.fft.fft2(gray)
        f_shift = np.fft.fftshift(f_transform)
        magnitude = np.abs(f_shift)
        
        # Normalized magnitude
        magnitude_normalized = (magnitude - np.min(magnitude)) / (np.max(magnitude) - np.min(magnitude) + 1e-6)
        
        # Moiré patterns appear as regular peaks in frequency domain
        threshold = np.mean(magnitude_normalized) + 2 * np.std(magnitude_normalized)
        peaks = np.sum(magnitude_normalized > threshold)
        
        # Score based on peak regularity
        peak_density = peaks / magnitude.size
        moire_score = min(1.0, peak_density * 10)
        
        return moire_score
    
    def _detect_regular_patterns(self, gray: np.ndarray) -> float:
        """Detect regular pixel grid patterns (screens)."""
        # Analyze frequency domain for regular patterns
        h, w = gray.shape
        
        # Horizontal and vertical Sobel
        sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        
        # Calculate regularity in gradients
        sobelx_mean = np.mean(np.abs(sobelx))
        sobely_mean = np.mean(np.abs(sobely))
        
        # High regularity suggests grid pattern
        regularity = (sobelx_mean + sobely_mean) / 512
        
        return min(1.0, regularity)
    
    def _detect_color_fringing(self, roi: np.ndarray) -> float:
        """Detect chromatic aberration (color fringing) from screens."""
        # Color fringing appears as color separation at edges
        
        b, g, r = cv2.split(roi)
        
        # Detect edges in each channel
        edges_r = cv2.Canny(r, 50, 150)
        edges_g = cv2.Canny(g, 50, 150)
        edges_b = cv2.Canny(b, 50, 150)
        
        # Calculate mismatch between channels
        mismatch = (np.sum(np.abs(edges_r.astype(int) - edges_g.astype(int))) +
                   np.sum(np.abs(edges_g.astype(int) - edges_b.astype(int)))) / 255
        
        fringing_score = min(1.0, mismatch / (roi.size / 10))
        
        return fringing_score
    
    def _analyze_reflection_patterns(self, roi: np.ndarray) -> float:
        """Analyze reflection patterns."""
        # Reflections on screens are regular, on faces are irregular
        
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        
        # Find bright regions
        bright_mask = gray > (np.mean(gray) + 2 * np.std(gray))
        
        # Analyze connectivity of bright regions
        # Screen reflections are more connected, face speculars are isolated
        
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        closed = cv2.morphologyEx(bright_mask.astype(np.uint8), cv2.MORPH_CLOSE, kernel)
        
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if len(contours) == 0:
            return 0.0
        
        # Regular patterns have fewer, larger contours
        avg_contour_size = np.mean([cv2.contourArea(c) for c in contours])
        contour_count = len(contours)
        
        # Screen reflections: few, large contours
        if contour_count < 5 and avg_contour_size > 20:
            reflection_regularity = 0.8
        else:
            reflection_regularity = 0.2
        
        return reflection_regularity
    
    def _calculate_spoofing_risk(self, results: Dict) -> float:
        """
        Calculate overall spoofing risk based on all detectors.
        """
        risk = 0.0
        
        # Printed image risk
        risk += results.get('printed_image', {}).get('printed_score', 0) * 0.3
        
        # Screen display risk
        risk += results.get('screen_display', {}).get('screen_score', 0) * 0.3
        
        # Texture anomaly risk
        texture_score = results.get('texture_analysis', {}).get('texture_score', 0.5)
        risk += (1 - texture_score) * 0.2  # Low texture score = higher risk
        
        # Motion-depth inconsistency
        consistency = results.get('motion_depth', {}).get('consistency_score', 0.5)
        risk += (1 - consistency) * 0.2
        
        return float(np.clip(risk, 0, 1))
    
    def reset(self):
        """Reset detector state."""
        self.frame_history.clear()
        self.texture_scores.clear()
        self.reflection_scores.clear()
        self.motion_consistency_scores.clear()
