"""
Active Liveness Challenge Manager Module
Manages and tracks active liveness challenges (head movements, eye blinks, mouth opening)
Pure geometric algorithms for challenge verification
"""

import numpy as np
import math
from typing import Dict, List, Optional, Tuple
from enum import Enum
from collections import deque


class ChallengeType(Enum):
    """Types of active liveness challenges."""
    HEAD_TURN_RIGHT = "head_turn_right"
    HEAD_TURN_LEFT = "head_turn_left"
    HEAD_TILT_UP = "head_tilt_up"
    HEAD_TILT_DOWN = "head_tilt_down"
    BLINK = "blink"
    MOUTH_OPEN = "mouth_open"
    SMILE = "smile"


class ChallengeStatus(Enum):
    """Challenge execution status."""
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"


class Challenge:
    """Represents a single challenge."""
    
    def __init__(self, challenge_type: ChallengeType, timeout_frames: int = 300):
        """
        Initialize a challenge.
        
        Args:
            challenge_type: Type of challenge
            timeout_frames: Maximum frames to complete challenge
        """
        self.type = challenge_type
        self.status = ChallengeStatus.PENDING
        self.timeout_frames = timeout_frames
        self.start_frame = None
        self.end_frame = None
        self.progress = 0.0
        self.required_duration = self._get_required_duration()
        self.duration_count = 0
        
    def _get_required_duration(self) -> int:
        """Get required frame duration for challenge completion."""
        if self.type == ChallengeType.BLINK:
            return 5  # Fast challenge
        elif self.type == ChallengeType.MOUTH_OPEN:
            return 10
        elif self.type == ChallengeType.SMILE:
            return 15
        else:  # Head movements
            return 20
    
    def update(self, is_performing: bool):
        """
        Update challenge progress.
        
        Args:
            is_performing: Whether user is performing the required action
        """
        if self.status == ChallengeStatus.COMPLETED:
            return
        
        if is_performing:
            self.duration_count += 1
            self.progress = min(1.0, self.duration_count / self.required_duration)
            
            if self.duration_count >= self.required_duration:
                self.status = ChallengeStatus.COMPLETED
        else:
            if self.status == ChallengeStatus.ACTIVE:
                # Reset counter if user stops performing
                self.duration_count = max(0, self.duration_count - 1)


class ChallengeManager:
    """
    Manages and tracks active liveness challenges.
    """
    
    def __init__(self, num_challenges: int = 3):
        """
        Initialize challenge manager.
        
        Args:
            num_challenges: Number of challenges to require
        """
        self.num_challenges = num_challenges
        self.challenges = []
        self.current_challenge_index = 0
        self.frame_count = 0
        self.challenge_sequence = self._generate_challenge_sequence()
        
        # Initialize challenges
        for challenge_type in self.challenge_sequence[:num_challenges]:
            self.challenges.append(Challenge(challenge_type))
        
        # History for trend analysis
        self.head_pose_history = deque(maxlen=30)
        self.mouth_distance_history = deque(maxlen=30)
        self.eye_closure_history = deque(maxlen=30)
        
    def _generate_challenge_sequence(self) -> List[ChallengeType]:
        """Generate a sequence of challenges."""
        return [
            ChallengeType.HEAD_TURN_RIGHT,
            ChallengeType.HEAD_TURN_LEFT,
            ChallengeType.BLINK,
            ChallengeType.MOUTH_OPEN,
        ]
    
    def update(self, head_pose: Dict[str, float], 
              landmarks_2d: Dict[str, Tuple[float, float]]) -> Dict:
        """
        Update challenge state based on current head pose and landmarks.
        
        Args:
            head_pose: Current head pose (yaw, pitch, roll)
            landmarks_2d: Current facial landmarks
            
        Returns:
            Dictionary with current challenge state
        """
        self.frame_count += 1
        
        # Store history
        self.head_pose_history.append(head_pose)
        
        # Get current challenge
        if self.current_challenge_index >= len(self.challenges):
            return {
                'all_challenges_completed': True,
                'current_challenge': None,
                'progress': 1.0
            }
        
        current_challenge = self.challenges[self.current_challenge_index]
        
        # Check if challenge is completed
        if current_challenge.status == ChallengeStatus.COMPLETED:
            self.current_challenge_index += 1
            if self.current_challenge_index < len(self.challenges):
                self.challenges[self.current_challenge_index].status = ChallengeStatus.ACTIVE
                current_challenge = self.challenges[self.current_challenge_index]
            else:
                return {
                    'all_challenges_completed': True,
                    'current_challenge': None,
                    'progress': 1.0
                }
        
        # Activate challenge if not yet active
        if current_challenge.status == ChallengeStatus.PENDING:
            current_challenge.status = ChallengeStatus.ACTIVE
            current_challenge.start_frame = self.frame_count
        
        # Check for timeout
        if current_challenge.start_frame and \
           (self.frame_count - current_challenge.start_frame) > current_challenge.timeout_frames:
            current_challenge.status = ChallengeStatus.TIMEOUT
            self.current_challenge_index += 1
        
        # Check challenge completion
        is_performing = self._check_challenge_performance(current_challenge, head_pose, landmarks_2d)
        current_challenge.update(is_performing)
        
        # Calculate overall progress
        completed_challenges = sum(1 for c in self.challenges 
                                  if c.status == ChallengeStatus.COMPLETED)
        overall_progress = completed_challenges / len(self.challenges)
        
        return {
            'current_challenge': current_challenge.type.value,
            'challenge_status': current_challenge.status.value,
            'challenge_progress': current_challenge.progress,
            'overall_progress': overall_progress,
            'completed_challenges': completed_challenges,
            'total_challenges': len(self.challenges),
            'all_challenges_completed': overall_progress == 1.0
        }
    
    def _check_challenge_performance(self, challenge: Challenge,
                                    head_pose: Dict[str, float],
                                    landmarks_2d: Dict[str, Tuple[float, float]]) -> bool:
        """
        Check if user is performing the required challenge action.
        
        Args:
            challenge: Current challenge
            head_pose: Current head pose
            landmarks_2d: Current landmarks
            
        Returns:
            Boolean indicating if challenge action is being performed
        """
        if challenge.type == ChallengeType.HEAD_TURN_RIGHT:
            return self._check_head_turn_right(head_pose)
        
        elif challenge.type == ChallengeType.HEAD_TURN_LEFT:
            return self._check_head_turn_left(head_pose)
        
        elif challenge.type == ChallengeType.HEAD_TILT_UP:
            return self._check_head_tilt_up(head_pose)
        
        elif challenge.type == ChallengeType.HEAD_TILT_DOWN:
            return self._check_head_tilt_down(head_pose)
        
        elif challenge.type == ChallengeType.BLINK:
            return self._check_blink(landmarks_2d)
        
        elif challenge.type == ChallengeType.MOUTH_OPEN:
            return self._check_mouth_open(landmarks_2d)
        
        elif challenge.type == ChallengeType.SMILE:
            return self._check_smile(landmarks_2d)
        
        return False
    
    def _check_head_turn_right(self, head_pose: Dict[str, float]) -> bool:
        """Check if head is turned right."""
        yaw = head_pose.get('yaw', 0)
        # Head turned right with threshold of 30 degrees
        return yaw > 30
    
    def _check_head_turn_left(self, head_pose: Dict[str, float]) -> bool:
        """Check if head is turned left."""
        yaw = head_pose.get('yaw', 0)
        # Head turned left with threshold of 30 degrees
        return yaw < -30
    
    def _check_head_tilt_up(self, head_pose: Dict[str, float]) -> bool:
        """Check if head is tilted up."""
        pitch = head_pose.get('pitch', 0)
        # Head tilted up (negative pitch)
        return pitch < -25
    
    def _check_head_tilt_down(self, head_pose: Dict[str, float]) -> bool:
        """Check if head is tilted down."""
        pitch = head_pose.get('pitch', 0)
        # Head tilted down (positive pitch)
        return pitch > 25
    
    def _check_blink(self, landmarks_2d: Dict[str, Tuple[float, float]]) -> bool:
        """
        Check if eyes are blinking.
        Simplified: detect rapid eye closure and opening.
        """
        eye_left = landmarks_2d.get('eye_left', None)
        eye_right = landmarks_2d.get('eye_right', None)
        
        if eye_left is None or eye_right is None:
            return False
        
        # Store eye distance
        eye_distance = math.sqrt((eye_right[0] - eye_left[0])**2 + 
                                 (eye_right[1] - eye_left[1])**2)
        self.eye_closure_history.append(eye_distance)
        
        if len(self.eye_closure_history) < 3:
            return False
        
        # Detect blink: sudden decrease then increase in eye distance
        recent_distances = list(self.eye_closure_history)[-5:]
        
        # Look for valley pattern (closed eyes)
        if len(recent_distances) >= 3:
            # Check if there's a significant dip (eyes closing)
            first = recent_distances[0]
            middle = min(recent_distances[1:-1])
            last = recent_distances[-1]
            
            # Blink detected if there's a notable drop and recovery
            if first > middle * 1.3 and last > middle * 1.3:
                return True
        
        return False
    
    def _check_mouth_open(self, landmarks_2d: Dict[str, Tuple[float, float]]) -> bool:
        """
        Check if mouth is open.
        Based on distance between mouth corners.
        """
        mouth_left = landmarks_2d.get('mouth_left', None)
        mouth_right = landmarks_2d.get('mouth_right', None)
        mouth_center = landmarks_2d.get('mouth_center', None)
        
        if mouth_left is None or mouth_right is None or mouth_center is None:
            return False
        
        # Calculate vertical mouth opening
        mouth_width = math.sqrt((mouth_right[0] - mouth_left[0])**2 + 
                                (mouth_right[1] - mouth_left[1])**2)
        
        # Calculate vertical distance (openness)
        # Assuming mouth_center is between lips
        mouth_opening = abs(mouth_center[1] - (mouth_left[1] + mouth_right[1]) / 2)
        
        # Store history
        self.mouth_distance_history.append(mouth_opening)
        
        # Mouth is open if opening is significant
        if len(self.mouth_distance_history) > 5:
            baseline_opening = np.mean(list(self.mouth_distance_history)[:-5])
            current_opening = mouth_opening
            
            # Threshold: current opening is 50% more than baseline
            return current_opening > baseline_opening * 1.5
        
        return mouth_opening > 5
    
    def _check_smile(self, landmarks_2d: Dict[str, Tuple[float, float]]) -> bool:
        """
        Check if face is smiling.
        Simplified: detect mouth corners elevation.
        """
        mouth_left = landmarks_2d.get('mouth_left', None)
        mouth_right = landmarks_2d.get('mouth_right', None)
        
        if mouth_left is None or mouth_right is None:
            return False
        
        # Check if mouth corners are elevated
        # Smile lifts corners (reduces Y coordinate)
        left_elevation = mouth_left[1]  # Lower Y = higher on screen
        right_elevation = mouth_right[1]
        
        # Compare with neutral position (estimated)
        # This is simplified; in real system would compare with baseline
        
        # For now, detect smile if mouth corners are relatively high
        face_bottom = landmarks_2d.get('face_bottom', (0, 0))
        mouth_center = landmarks_2d.get('mouth_center', (0, 0))
        
        if face_bottom[1] > 0 and mouth_center[1] > 0:
            # Smile detection: mouth corners above center
            avg_corner_y = (left_elevation + right_elevation) / 2
            center_y = mouth_center[1]
            
            return avg_corner_y < center_y
        
        return False
    
    def get_challenge_instruction(self) -> str:
        """Get instruction for current challenge."""
        if self.current_challenge_index >= len(self.challenges):
            return "All challenges completed!"
        
        challenge = self.challenges[self.current_challenge_index]
        
        instructions = {
            ChallengeType.HEAD_TURN_RIGHT: "Turn your head to the right",
            ChallengeType.HEAD_TURN_LEFT: "Turn your head to the left",
            ChallengeType.HEAD_TILT_UP: "Tilt your head up",
            ChallengeType.HEAD_TILT_DOWN: "Tilt your head down",
            ChallengeType.BLINK: "Blink your eyes",
            ChallengeType.MOUTH_OPEN: "Open your mouth",
            ChallengeType.SMILE: "Smile",
        }
        
        return instructions.get(challenge.type, "Perform the challenge")
    
    def are_all_challenges_completed(self) -> bool:
        """Check if all challenges are completed."""
        return all(c.status == ChallengeStatus.COMPLETED for c in self.challenges)
    
    def get_completion_percentage(self) -> float:
        """Get overall completion percentage."""
        completed = sum(1 for c in self.challenges 
                       if c.status == ChallengeStatus.COMPLETED)
        return (completed / len(self.challenges)) * 100 if self.challenges else 0
    
    def reset(self):
        """Reset all challenges."""
        self.challenges.clear()
        for challenge_type in self.challenge_sequence[:self.num_challenges]:
            self.challenges.append(Challenge(challenge_type))
        
        self.current_challenge_index = 0
        self.frame_count = 0
        self.head_pose_history.clear()
        self.mouth_distance_history.clear()
        self.eye_closure_history.clear()
