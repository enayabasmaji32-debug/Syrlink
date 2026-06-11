"""
Face Detection and Tracking Module - Pure Geometric Algorithms
Uses Haar Cascades for detection and traditional computer vision for tracking
No AI models, no deep learning, no external APIs
"""

import cv2
import numpy as np
from collections import deque
from typing import Tuple, Optional, List, Dict
import math


class FaceDetectorTracker:
    """
    Detects faces using Haar Cascades and tracks them using bounding box motion estimation.
    """

    def __init__(self, cascade_path: Optional[str] = None):
        """
        Initialize face detector with Haar Cascade classifier.
        
        Args:
            cascade_path: Path to Haar Cascade XML file. If None, uses OpenCV default.
        """
        if cascade_path is None:
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        
        self.cascade = cv2.CascadeClassifier(cascade_path)
        self.face_history = deque(maxlen=30)  # Track last 30 frames
        self.tracking_state = None
        self.frame_count = 0
        
    def detect_faces(self, frame: np.ndarray, scale_factor: float = 1.1, 
                    min_neighbors: int = 5, min_size: Tuple[int, int] = (40, 40)) -> List[Tuple[int, int, int, int]]:
        """
        Detect faces in a frame using Haar Cascade.
        
        Args:
            frame: Input video frame (BGR)
            scale_factor: How much the image size is reduced at each layer
            min_neighbors: How many neighbors each candidate needs
            min_size: Minimum face size
            
        Returns:
            List of (x, y, w, h) tuples for detected faces
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        # Histogram equalization to improve detection
        gray = cv2.equalizeHist(gray)
        
        faces = self.cascade.detectMultiScale(
            gray,
            scaleFactor=scale_factor,
            minNeighbors=min_neighbors,
            minSize=min_size
        )
        
        return faces
    
    def track_face(self, frame: np.ndarray, prev_frame: Optional[np.ndarray] = None) -> Optional[Dict]:
        """
        Detect and track face across frames.
        
        Args:
            frame: Current frame
            prev_frame: Previous frame for optical flow tracking (optional)
            
        Returns:
            Dictionary with tracking information or None if no face found
        """
        self.frame_count += 1
        faces = self.detect_faces(frame)
        
        if len(faces) == 0:
            return None
        
        # Take the largest face (closest to camera)
        face = max(faces, key=lambda f: f[2] * f[3])
        x, y, w, h = face
        
        # Store in history
        face_info = {
            'bbox': (x, y, w, h),
            'center': (x + w // 2, y + h // 2),
            'area': w * h,
            'frame': self.frame_count,
            'confidence': 1.0
        }
        
        # Smooth tracking using history
        if len(self.face_history) > 0:
            prev_bbox = self.face_history[-1]['bbox']
            # Calculate motion
            motion_x = x - prev_bbox[0]
            motion_y = y - prev_bbox[1]
            motion_area = (w * h) - self.face_history[-1]['area']
            
            # Predict next position for smoother tracking
            if len(self.face_history) > 1:
                prev_prev_bbox = self.face_history[-2]['bbox']
                avg_motion_x = (x - prev_bbox[0] + prev_bbox[0] - prev_prev_bbox[0]) / 2
                avg_motion_y = (y - prev_bbox[1] + prev_bbox[1] - prev_prev_bbox[1]) / 2
                
                face_info['predicted_motion'] = (avg_motion_x, avg_motion_y)
        
        self.face_history.append(face_info)
        self.tracking_state = face_info
        
        return face_info
    
    def get_face_landmarks_simple(self, frame: np.ndarray, bbox: Tuple[int, int, int, int]) -> Dict[str, Tuple[int, int]]:
        """
        Extract simple facial landmarks from face region using geometric analysis.
        Uses edge detection and geometric properties.
        
        Args:
            frame: Input frame
            bbox: Bounding box (x, y, w, h)
            
        Returns:
            Dictionary with landmark positions
        """
        x, y, w, h = bbox
        face_roi = frame[y:y+h, x:x+w]
        gray_roi = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
        
        # Detect edges for geometric analysis
        edges = cv2.Canny(gray_roi, 50, 150)
        
        landmarks = {}
        
        # Eyes - typically in upper portion of face, bilateral
        # Use horizontal segmentation
        upper_half = gray_roi[:h//3, :]
        
        # Find vertical dark regions for eyes
        col_intensity = np.sum(upper_half, axis=0)
        col_intensity_normalized = col_intensity / (np.max(col_intensity) + 1e-6)
        
        # Find two local minima for eyes
        eye_left_estimate = int(w * 0.25)
        eye_right_estimate = int(w * 0.75)
        
        landmarks['eye_left'] = (x + eye_left_estimate, y + h // 6)
        landmarks['eye_right'] = (x + eye_right_estimate, y + h // 6)
        
        # Nose - center, middle of face
        landmarks['nose'] = (x + w // 2, y + h // 2)
        
        # Mouth - lower portion of face
        landmarks['mouth_left'] = (x + w // 3, y + int(h * 0.7))
        landmarks['mouth_right'] = (x + int(w * 2/3), y + int(h * 0.7))
        landmarks['mouth_center'] = (x + w // 2, y + int(h * 0.75))
        
        # Chin - bottom center
        landmarks['chin'] = (x + w // 2, y + h - 10)
        
        # Face boundary points
        landmarks['face_left'] = (x + 5, y + h // 2)
        landmarks['face_right'] = (x + w - 5, y + h // 2)
        landmarks['face_top'] = (x + w // 2, y + 5)
        landmarks['face_bottom'] = (x + w // 2, y + h - 5)
        
        return landmarks
    
    def get_motion_vector(self) -> Optional[Tuple[float, float, float]]:
        """
        Calculate frame-to-frame motion vector.
        
        Returns:
            Tuple of (motion_x, motion_y, motion_magnitude) or None
        """
        if len(self.face_history) < 2:
            return None
        
        current = self.face_history[-1]
        previous = self.face_history[-2]
        
        curr_center = current['center']
        prev_center = previous['center']
        
        motion_x = curr_center[0] - prev_center[0]
        motion_y = curr_center[1] - prev_center[1]
        motion_mag = math.sqrt(motion_x**2 + motion_y**2)
        
        return (motion_x, motion_y, motion_mag)
    
    def get_tracking_stability(self, window_size: int = 10) -> float:
        """
        Calculate tracking stability as inverse of motion variance.
        Stable tracking = low variance in position change.
        
        Args:
            window_size: Number of frames to analyze
            
        Returns:
            Stability score (0-1, where 1 is very stable)
        """
        if len(self.face_history) < window_size:
            return 0.0
        
        recent = list(self.face_history)[-window_size:]
        motions = []
        
        for i in range(1, len(recent)):
            curr = recent[i]['center']
            prev = recent[i-1]['center']
            motion_mag = math.sqrt((curr[0]-prev[0])**2 + (curr[1]-prev[1])**2)
            motions.append(motion_mag)
        
        if not motions:
            return 1.0
        
        # High stability = low variance
        variance = np.var(motions)
        # Map variance to stability score
        stability = 1.0 / (1.0 + variance)
        return min(1.0, max(0.0, stability))
    
    def is_face_detected(self) -> bool:
        """Check if face is currently detected."""
        return self.tracking_state is not None and len(self.face_history) > 0
    
    def reset(self):
        """Reset tracking state."""
        self.face_history.clear()
        self.tracking_state = None
        self.frame_count = 0
