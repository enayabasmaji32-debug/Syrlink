"""
Head Pose Estimation Module - Pure Geometric Algorithms
Estimates head rotation (yaw, pitch, roll) using simple 3D head model and geometric calculations
No AI models, no deep learning
"""

import numpy as np
import math
from typing import Tuple, Dict, Optional
from collections import deque


class SimplifiedHeadModel:
    """
    Simplified 3D head model with key landmarks.
    Based on average human head proportions.
    """
    
    def __init__(self):
        """Initialize 3D head model in mm (relative to face width)."""
        # Normalized to face width = 100mm
        self.model_points = np.array([
            (0, -35),      # Eyes center (Y coordinate above nose)
            (0, 0),        # Nose tip
            (0, 35),       # Mouth center
            (-30, -25),    # Left eye
            (30, -25),     # Right eye
            (-50, 20),     # Left mouth corner
            (50, 20),      # Right mouth corner
            (0, 50),       # Chin
        ], dtype=np.float32)
        
        # Add Z coordinate (depth)
        self.model_points_3d = np.column_stack([
            self.model_points,
            np.zeros(len(self.model_points))
        ])


class HeadPoseEstimator:
    """
    Estimates head pose (yaw, pitch, roll) using geometric calculations.
    Uses simplified 3D head model and 2D landmark positions.
    """
    
    def __init__(self, face_width_mm: float = 100.0):
        """
        Initialize head pose estimator.
        
        Args:
            face_width_mm: Assumed face width in mm (for scale estimation)
        """
        self.head_model = SimplifiedHeadModel()
        self.face_width_mm = face_width_mm
        self.pose_history = deque(maxlen=20)
        
    def estimate_head_pose(self, landmarks_2d: Dict[str, Tuple[float, float]], 
                          face_bbox: Tuple[int, int, int, int]) -> Dict[str, float]:
        """
        Estimate head pose angles using geometric analysis of landmarks.
        
        Args:
            landmarks_2d: Dictionary of 2D landmark positions
            face_bbox: Face bounding box (x, y, w, h)
            
        Returns:
            Dictionary with yaw, pitch, roll angles in degrees
        """
        x, y, w, h = face_bbox
        
        # Get key landmarks
        nose = landmarks_2d.get('nose', (x + w//2, y + h//2))
        eye_left = landmarks_2d.get('eye_left', (x + w//4, y + h//4))
        eye_right = landmarks_2d.get('eye_right', (x + 3*w//4, y + h//4))
        mouth_center = landmarks_2d.get('mouth_center', (x + w//2, y + 3*h//4))
        chin = landmarks_2d.get('chin', (x + w//2, y + h))
        
        # Calculate face center (reference point)
        face_center = (x + w//2, y + h//2)
        
        # Calculate angles based on landmark positions relative to face center
        yaw = self._calculate_yaw(nose, eye_left, eye_right, face_center)
        pitch = self._calculate_pitch(nose, eye_left, eye_right, chin, face_center)
        roll = self._calculate_roll(eye_left, eye_right, face_center)
        
        pose = {
            'yaw': yaw,
            'pitch': pitch,
            'roll': roll,
            'confidence': 0.8  # Simplified confidence
        }
        
        self.pose_history.append(pose)
        
        return pose
    
    def _calculate_yaw(self, nose: Tuple[float, float], 
                      eye_left: Tuple[float, float],
                      eye_right: Tuple[float, float],
                      face_center: Tuple[float, float]) -> float:
        """
        Calculate yaw (left-right head rotation) angle.
        
        Positive = right rotation, Negative = left rotation
        """
        # Vector from face center to nose
        nose_vec_x = nose[0] - face_center[0]
        
        # Vector from left eye to right eye (horizontal axis)
        eye_axis = eye_right[0] - eye_left[0]
        
        # Calculate angle: arctan(nose displacement / eye distance)
        if eye_axis == 0:
            return 0.0
        
        yaw_rad = math.atan2(nose_vec_x, eye_axis)
        yaw_deg = math.degrees(yaw_rad)
        
        # Normalize to [-90, 90]
        return np.clip(yaw_deg, -90, 90)
    
    def _calculate_pitch(self, nose: Tuple[float, float],
                        eye_left: Tuple[float, float],
                        eye_right: Tuple[float, float],
                        chin: Tuple[float, float],
                        face_center: Tuple[float, float]) -> float:
        """
        Calculate pitch (up-down head rotation) angle.
        
        Positive = down tilt, Negative = up tilt
        """
        # Eye-to-nose vertical distance
        eyes_y = (eye_left[1] + eye_right[1]) / 2
        
        # Vertical distance from eyes to nose to chin
        nose_to_eyes = nose[1] - eyes_y
        nose_to_chin = chin[1] - nose[1]
        
        # Calculate pitch based on vertical proportions
        total_vertical = nose_to_chin + abs(nose_to_eyes)
        
        if total_vertical == 0:
            return 0.0
        
        # Ratio determines pitch
        ratio = nose_to_eyes / total_vertical
        
        # Map ratio to angle [-60, 60]
        pitch_deg = (ratio - 0.5) * 120
        
        return np.clip(pitch_deg, -60, 60)
    
    def _calculate_roll(self, eye_left: Tuple[float, float],
                       eye_right: Tuple[float, float],
                       face_center: Tuple[float, float]) -> float:
        """
        Calculate roll (head tilt) angle.
        
        Based on eye alignment
        """
        # Calculate angle of line between eyes
        dy = eye_right[1] - eye_left[1]
        dx = eye_right[0] - eye_left[0]
        
        if dx == 0:
            return 90.0 if dy > 0 else -90.0
        
        roll_rad = math.atan2(dy, dx)
        roll_deg = math.degrees(roll_rad)
        
        # Normalize to [-45, 45]
        return np.clip(roll_deg, -45, 45)
    
    def get_head_orientation_vector(self) -> Optional[Tuple[float, float, float]]:
        """
        Get head orientation as a normalized 3D direction vector.
        
        Returns:
            (x, y, z) normalized vector or None
        """
        if not self.pose_history:
            return None
        
        latest_pose = self.pose_history[-1]
        yaw = math.radians(latest_pose['yaw'])
        pitch = math.radians(latest_pose['pitch'])
        
        # Convert Euler angles to direction vector
        # Simplified: using yaw and pitch
        x = math.sin(yaw)
        y = math.sin(pitch)
        z = math.cos(yaw) * math.cos(pitch)
        
        # Normalize
        magnitude = math.sqrt(x**2 + y**2 + z**2)
        if magnitude > 0:
            return (x/magnitude, y/magnitude, z/magnitude)
        
        return (0, 0, 1)
    
    def get_pose_change(self) -> Optional[Dict[str, float]]:
        """
        Calculate change in pose between current and previous frame.
        
        Returns:
            Dictionary with yaw_change, pitch_change, roll_change
        """
        if len(self.pose_history) < 2:
            return None
        
        current = self.pose_history[-1]
        previous = self.pose_history[-2]
        
        return {
            'yaw_change': current['yaw'] - previous['yaw'],
            'pitch_change': current['pitch'] - previous['pitch'],
            'roll_change': current['roll'] - previous['roll'],
            'total_change': abs(current['yaw'] - previous['yaw']) + 
                           abs(current['pitch'] - previous['pitch']) +
                           abs(current['roll'] - previous['roll'])
        }
    
    def is_head_turned_right(self, threshold: float = 30.0) -> bool:
        """Check if head is turned right beyond threshold."""
        if not self.pose_history:
            return False
        latest = self.pose_history[-1]
        return latest['yaw'] > threshold
    
    def is_head_turned_left(self, threshold: float = 30.0) -> bool:
        """Check if head is turned left beyond threshold."""
        if not self.pose_history:
            return False
        latest = self.pose_history[-1]
        return latest['yaw'] < -threshold
    
    def is_head_tilted_up(self, threshold: float = 25.0) -> bool:
        """Check if head is tilted up beyond threshold."""
        if not self.pose_history:
            return False
        latest = self.pose_history[-1]
        return latest['pitch'] < -threshold
    
    def is_head_tilted_down(self, threshold: float = 25.0) -> bool:
        """Check if head is tilted down beyond threshold."""
        if not self.pose_history:
            return False
        latest = self.pose_history[-1]
        return latest['pitch'] > threshold
    
    def reset(self):
        """Reset pose history."""
        self.pose_history.clear()
