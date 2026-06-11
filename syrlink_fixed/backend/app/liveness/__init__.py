"""
Liveness Detection Package
Advanced liveness detection using pure geometric algorithms and image processing
No AI models, no deep learning, no external APIs
"""

from .face_detector_tracker import FaceDetectorTracker
from .head_pose_estimator import HeadPoseEstimator
from .liveness_detector import LivenessDetector, LivenessState
from .anti_spoofing import AntiSpoofingDetector
from .challenge_manager import ChallengeManager, ChallengeType, ChallengeStatus
from .video_processor import VideoLivenessProcessor

__version__ = '1.0.0'
__all__ = [
    'FaceDetectorTracker',
    'HeadPoseEstimator',
    'LivenessDetector',
    'LivenessState',
    'AntiSpoofingDetector',
    'ChallengeManager',
    'ChallengeType',
    'ChallengeStatus',
    'VideoLivenessProcessor',
]
