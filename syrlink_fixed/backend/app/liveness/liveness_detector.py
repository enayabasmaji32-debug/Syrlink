"""
Liveness Detection Module - Pure Geometric Analysis
Detects genuine face presence through motion and temporal analysis
No AI models, no deep learning
"""

import numpy as np
import cv2
import math
from typing import Dict, Tuple, List, Optional
from collections import deque
from enum import Enum


class LivenessState(Enum):
    """Liveness detection states."""
    INITIALIZING = "initializing"
    ANALYZING = "analyzing"
    CHALLENGE_ACTIVE = "challenge_active"
    LIVENESS_CONFIRMED = "liveness_confirmed"
    LIVENESS_FAILED = "liveness_failed"
    NO_FACE = "no_face"


class LivenessDetector:
    """
    Detects liveness through motion and temporal analysis.
    Checks for natural micro-movements, head motion, and temporal consistency.
    """
    
    def __init__(self, analysis_duration: int = 150, fps: int = 30):
        """
        Initialize liveness detector.
        
        Args:
            analysis_duration: Duration in frames for analysis (default ~5 seconds at 30fps)
            fps: Frames per second of video
        """
        self.analysis_duration = analysis_duration
        self.fps = fps
        self.frame_count = 0
        self.state = LivenessState.INITIALIZING
        
        # Motion tracking
        self.landmark_positions = deque(maxlen=60)  # Last 2 seconds
        self.face_positions = deque(maxlen=60)
        self.head_poses = deque(maxlen=60)
        
        # Liveness indicators
        self.motion_detected = False
        self.micro_movements_detected = False
        self.temporal_consistency = 1.0
        self.depth_variance = 0.0
        
        # Counters
        self.blink_count = 0
        self.micro_movement_count = 0
        
    def analyze_frame(self, 
                     landmarks_2d: Dict[str, Tuple[float, float]],
                     face_bbox: Tuple[int, int, int, int],
                     head_pose: Dict[str, float],
                     frame_data: Optional[np.ndarray] = None) -> Dict:
        """
        Analyze current frame for liveness indicators.
        
        Args:
            landmarks_2d: 2D landmark positions
            face_bbox: Face bounding box
            head_pose: Head pose angles
            frame_data: Optional frame data for additional analysis
            
        Returns:
            Dictionary with liveness indicators
        """
        self.frame_count += 1
        
        # Store positions
        landmarks_pos = {k: v for k, v in landmarks_2d.items()}
        self.landmark_positions.append(landmarks_pos)
        self.face_positions.append(face_bbox)
        self.head_poses.append(head_pose)
        
        # Analyze motion
        motion_analysis = self._analyze_motion()
        
        # Detect micro-movements
        micro_movement_analysis = self._detect_micro_movements()
        
        # Analyze temporal consistency
        temporal_analysis = self._analyze_temporal_consistency()
        
        # Analyze depth indicators
        depth_analysis = self._analyze_depth_cues(landmarks_2d, face_bbox)
        
        # Detect blinks
        blink_info = self._detect_blinks(landmarks_2d)
        
        result = {
            'frame': self.frame_count,
            'state': self.state.value,
            'motion': motion_analysis,
            'micro_movements': micro_movement_analysis,
            'temporal': temporal_analysis,
            'depth': depth_analysis,
            'blink': blink_info,
            'liveness_score': self._calculate_liveness_score(
                motion_analysis, micro_movement_analysis, temporal_analysis, depth_analysis
            )
        }
        
        return result
    
    def _analyze_motion(self) -> Dict[str, float]:
        """
        Analyze frame-to-frame motion of face and landmarks.
        """
        if len(self.face_positions) < 2:
            return {'total_motion': 0.0, 'motion_trend': 'stable'}
        
        # Calculate motion magnitudes
        motions = []
        for i in range(1, len(self.face_positions)):
            prev_bbox = self.face_positions[i-1]
            curr_bbox = self.face_positions[i]
            
            motion_x = (curr_bbox[0] + curr_bbox[2]//2) - (prev_bbox[0] + prev_bbox[2]//2)
            motion_y = (curr_bbox[1] + curr_bbox[3]//2) - (prev_bbox[1] + prev_bbox[3]//2)
            motion_mag = math.sqrt(motion_x**2 + motion_y**2)
            motions.append(motion_mag)
        
        if not motions:
            return {'total_motion': 0.0, 'motion_trend': 'stable'}
        
        avg_motion = np.mean(motions)
        motion_var = np.var(motions)
        
        # Determine motion trend
        if len(motions) > 10:
            recent_avg = np.mean(motions[-5:])
            older_avg = np.mean(motions[-10:-5])
            
            if recent_avg > older_avg * 1.2:
                trend = 'increasing'
            elif recent_avg < older_avg * 0.8:
                trend = 'decreasing'
            else:
                trend = 'stable'
        else:
            trend = 'stable'
        
        # Motion detection: some motion but not excessive
        motion_detected = 0.5 < avg_motion < 50
        self.motion_detected = motion_detected
        
        return {
            'avg_motion': float(avg_motion),
            'motion_variance': float(motion_var),
            'motion_detected': motion_detected,
            'motion_trend': trend
        }
    
    def _detect_micro_movements(self) -> Dict:
        """
        Detect small natural movements in facial features.
        Focuses on eye and mouth micro-movements.
        """
        if len(self.landmark_positions) < 5:
            return {'micro_movements': False, 'movement_points': []}
        
        movement_points = []
        
        # Analyze eye position changes
        eye_left_positions = [lm.get('eye_left', (0, 0)) for lm in self.landmark_positions]
        eye_right_positions = [lm.get('eye_right', (0, 0)) for lm in self.landmark_positions]
        mouth_positions = [lm.get('mouth_center', (0, 0)) for lm in self.landmark_positions]
        
        # Calculate variances in positions
        if len(eye_left_positions) > 1:
            eye_left_var = np.var([pos[0] for pos in eye_left_positions]) + \
                          np.var([pos[1] for pos in eye_left_positions])
            if eye_left_var > 2.0:  # Threshold for micro-movement
                movement_points.append('eye_left')
        
        if len(eye_right_positions) > 1:
            eye_right_var = np.var([pos[0] for pos in eye_right_positions]) + \
                           np.var([pos[1] for pos in eye_right_positions])
            if eye_right_var > 2.0:
                movement_points.append('eye_right')
        
        if len(mouth_positions) > 1:
            mouth_var = np.var([pos[0] for pos in mouth_positions]) + \
                       np.var([pos[1] for pos in mouth_positions])
            if mouth_var > 1.5:
                movement_points.append('mouth')
        
        micro_movements_detected = len(movement_points) >= 1
        self.micro_movements_detected = micro_movements_detected
        self.micro_movement_count += len(movement_points)
        
        return {
            'micro_movements': micro_movements_detected,
            'movement_points': movement_points,
            'total_micro_movements': self.micro_movement_count
        }
    
    def _analyze_temporal_consistency(self) -> Dict[str, float]:
        """
        Analyze consistency of face tracking over time.
        Detects if face region is changing smoothly (natural) or has jumps (video artifact).
        """
        if len(self.face_positions) < 3:
            return {'consistency_score': 1.0, 'is_consistent': True}
        
        # Calculate frame-to-frame changes
        changes = []
        for i in range(1, len(self.face_positions)):
            prev = self.face_positions[i-1]
            curr = self.face_positions[i]
            
            # Change in position and size
            pos_change = math.sqrt((curr[0]-prev[0])**2 + (curr[1]-prev[1])**2)
            size_change = abs((curr[2]*curr[3]) - (prev[2]*prev[3]))
            
            changes.append((pos_change, size_change))
        
        if not changes:
            return {'consistency_score': 1.0, 'is_consistent': True}
        
        # Analyze change distribution
        pos_changes = [c[0] for c in changes]
        size_changes = [c[1] for c in changes]
        
        # Calculate coefficient of variation (stability measure)
        pos_mean = np.mean(pos_changes)
        pos_std = np.std(pos_changes)
        
        if pos_mean > 0:
            cv = pos_std / (pos_mean + 1e-6)
        else:
            cv = 0
        
        # Consistency score: lower CV = higher consistency
        consistency_score = 1.0 / (1.0 + cv)
        is_consistent = consistency_score > 0.5
        
        self.temporal_consistency = consistency_score
        
        return {
            'consistency_score': float(consistency_score),
            'is_consistent': is_consistent,
            'position_std': float(pos_std),
            'size_std': float(np.std(size_changes))
        }
    
    def _analyze_depth_cues(self, landmarks_2d: Dict[str, Tuple[float, float]], 
                           face_bbox: Tuple[int, int, int, int]) -> Dict:
        """
        Analyze depth cues from head movement and landmark changes.
        When head moves in 3D space, landmark positions should change in specific ways.
        """
        if len(self.head_poses) < 3:
            return {'depth_variance': 0.0, 'has_depth': False}
        
        x, y, w, h = face_bbox
        
        # Measure face aspect ratio changes (indicates depth change)
        if len(self.face_positions) > 1:
            face_sizes = [p[2] * p[3] for p in self.face_positions]
            face_size_var = np.var(face_sizes)
        else:
            face_size_var = 0.0
        
        # Measure landmark spread changes (indicates depth change)
        eye_left = landmarks_2d.get('eye_left', (x + w//4, y + h//3))
        eye_right = landmarks_2d.get('eye_right', (x + 3*w//4, y + h//3))
        eye_distance = math.sqrt((eye_right[0] - eye_left[0])**2 + 
                                 (eye_right[1] - eye_left[1])**2)
        
        # Check if eye distance varies (head moving in depth)
        if len(self.landmark_positions) > 1:
            eye_distances = []
            for lm in self.landmark_positions:
                el = lm.get('eye_left', (x + w//4, y + h//3))
                er = lm.get('eye_right', (x + 3*w//4, y + h//3))
                dist = math.sqrt((er[0] - el[0])**2 + (er[1] - el[1])**2)
                eye_distances.append(dist)
            
            eye_distance_var = np.var(eye_distances)
        else:
            eye_distance_var = 0.0
        
        self.depth_variance = face_size_var + eye_distance_var
        has_depth = self.depth_variance > 5.0  # Threshold
        
        # Check pose variation (indicates 3D head movement)
        pose_yaws = [pose.get('yaw', 0) for pose in self.head_poses]
        pose_pitches = [pose.get('pitch', 0) for pose in self.head_poses]
        
        yaw_var = np.var(pose_yaws)
        pitch_var = np.var(pose_pitches)
        pose_variance = yaw_var + pitch_var
        
        return {
            'depth_variance': float(self.depth_variance),
            'face_size_variance': float(face_size_var),
            'eye_distance_variance': float(eye_distance_var),
            'pose_variance': float(pose_variance),
            'has_depth': has_depth
        }
    
    def _detect_blinks(self, landmarks_2d: Dict[str, Tuple[float, float]]) -> Dict:
        """
        Detect eye blinks by analyzing eye region changes.
        """
        eye_left = landmarks_2d.get('eye_left', None)
        eye_right = landmarks_2d.get('eye_right', None)
        
        if eye_left is None or eye_right is None:
            return {'blink_detected': False, 'total_blinks': self.blink_count}
        
        # Simple blink detection: eye position variance over time
        if len(self.landmark_positions) > 5:
            recent_eye_positions = []
            for lm in list(self.landmark_positions)[-6:-1]:
                el = lm.get('eye_left', eye_left)
                er = lm.get('eye_right', eye_right)
                recent_eye_positions.append((el, er))
            
            # Check for eye closure (sudden decrease in vertical distance)
            # This is a simplified blink detection
            if len(recent_eye_positions) > 1:
                prev_left, prev_right = recent_eye_positions[-2]
                curr_left, curr_right = recent_eye_positions[-1]
                
                prev_dist = abs(prev_left[1] - prev_right[1])
                curr_dist = abs(curr_left[1] - curr_right[1])
                
                # Potential blink if distance decreased significantly
                if prev_dist > 0 and curr_dist < prev_dist * 0.3:
                    blink_detected = True
                    self.blink_count += 1
                else:
                    blink_detected = False
            else:
                blink_detected = False
        else:
            blink_detected = False
        
        return {
            'blink_detected': blink_detected,
            'total_blinks': self.blink_count
        }
    
    def _calculate_liveness_score(self, motion_analysis: Dict, 
                                  micro_movement_analysis: Dict,
                                  temporal_analysis: Dict,
                                  depth_analysis: Dict) -> float:
        """
        Calculate overall liveness score (0-100).
        """
        score = 0.0
        
        # Motion score (25%)
        if motion_analysis.get('motion_detected', False):
            score += 25
        else:
            motion_val = motion_analysis.get('avg_motion', 0)
            score += min(25, (motion_val / 2))
        
        # Micro-movements score (25%)
        if micro_movement_analysis.get('micro_movements', False):
            movement_count = len(micro_movement_analysis.get('movement_points', []))
            score += min(25, movement_count * 10)
        
        # Temporal consistency score (25%)
        consistency = temporal_analysis.get('consistency_score', 0)
        score += consistency * 25
        
        # Depth score (25%)
        if depth_analysis.get('has_depth', False):
            score += 25
        else:
            depth_var = depth_analysis.get('depth_variance', 0)
            score += min(25, depth_var * 2)
        
        # Blink bonus (up to 5%)
        if self.blink_count > 0:
            score = min(100, score + 5)
        
        return float(np.clip(score, 0, 100))
    
    def is_liveness_confirmed(self, threshold: float = 70.0) -> bool:
        """Check if liveness is confirmed based on analysis."""
        # Minimum duration check
        if self.frame_count < self.analysis_duration // 2:
            return False
        
        # All indicators should be positive
        return (self.motion_detected and 
                self.micro_movements_detected and 
                self.temporal_consistency > 0.5 and
                self.blink_count > 0)
    
    def reset(self):
        """Reset detector state."""
        self.frame_count = 0
        self.landmark_positions.clear()
        self.face_positions.clear()
        self.head_poses.clear()
        self.blink_count = 0
        self.micro_movement_count = 0
        self.state = LivenessState.INITIALIZING
