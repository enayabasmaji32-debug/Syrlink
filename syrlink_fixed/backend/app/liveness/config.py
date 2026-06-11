"""
Configuration for Liveness Detection System
"""

import os
from datetime import timedelta


class LivenessConfig:
    """
    Configuration for liveness detection.
    """
    
    # Session management
    SESSION_TIMEOUT_SECONDS = 300  # 5 minutes
    MAX_SESSIONS = 1000
    SESSION_CLEANUP_INTERVAL = 60  # seconds
    
    # Processing
    TARGET_FPS = 30
    ANALYSIS_DURATION_SECONDS = 5
    MIN_FRAMES_FOR_VERIFICATION = 150  # At least 5 seconds at 30fps
    
    # Face detection
    FACE_DETECTION_SCALE_FACTOR = 1.1
    FACE_DETECTION_MIN_NEIGHBORS = 5
    FACE_DETECTION_MIN_SIZE = (40, 40)
    
    # Head pose estimation
    FACE_WIDTH_MM = 100.0  # Assumed face width in mm
    
    # Liveness detection thresholds
    LIVENESS_SCORE_THRESHOLD = 70.0  # Minimum score for liveness confirmation
    MIN_MOTION_FOR_LIVENESS = 0.5  # Minimum motion pixels per frame
    MIN_MICRO_MOVEMENTS = 1  # Minimum micro-movement points
    MIN_BLINKS_FOR_VERIFICATION = 1  # Minimum blinks required
    
    # Anti-spoofing detection thresholds
    SPOOFING_RISK_THRESHOLD = 0.6  # Risk level for spoofing rejection
    PRINTED_IMAGE_THRESHOLD = 0.5
    SCREEN_DISPLAY_THRESHOLD = 0.5
    
    # Active challenges
    ENABLE_CHALLENGES = True
    NUM_CHALLENGES_REQUIRED = 3
    CHALLENGE_TIMEOUT_FRAMES = 300  # About 10 seconds at 30fps
    
    # Challenge thresholds
    HEAD_TURN_THRESHOLD_DEGREES = 30
    HEAD_TILT_THRESHOLD_DEGREES = 25
    MOUTH_OPENING_RATIO = 1.5  # Ratio above baseline
    
    # Confidence calculation
    CONFIDENCE_WEIGHT_LIVENESS = 0.4
    CONFIDENCE_WEIGHT_ANTI_SPOOFING = 0.3
    CONFIDENCE_WEIGHT_CHALLENGES = 0.3
    
    # Frame history
    MOTION_HISTORY_FRAMES = 60  # 2 seconds at 30fps
    POSE_HISTORY_FRAMES = 30
    LANDMARK_HISTORY_FRAMES = 60
    
    # Quality requirements
    MIN_FACE_SIZE_RATIO = 0.1  # Face should be at least 10% of frame
    MAX_FACE_SIZE_RATIO = 0.8  # Face should be at most 80% of frame
    MIN_TRACKING_STABILITY = 0.3
    
    # Results storage
    STORE_FRAMES = False  # Whether to store frame data in database
    STORE_LANDMARKS = False  # Whether to store landmark data
    STORE_FULL_ANALYSIS = True  # Store complete analysis results
    
    # Logging
    LOG_LEVEL = os.getenv('LIVENESS_LOG_LEVEL', 'INFO')
    LOG_FILE = 'logs/liveness_detection.log'
    
    # Security
    REQUIRE_HTTPS_FOR_API = os.getenv('LIVENESS_REQUIRE_HTTPS', 'false').lower() == 'true'
    ENABLE_RATE_LIMITING = True
    RATE_LIMIT_REQUESTS_PER_MINUTE = 60
    
    # Performance
    USE_GPU = os.getenv('LIVENESS_USE_GPU', 'false').lower() == 'true'
    NUM_WORKERS = int(os.getenv('LIVENESS_NUM_WORKERS', '4'))
    MAX_FRAME_SIZE = (1280, 720)  # Maximum frame resolution
    
    # Anti-spoofing advanced
    ENABLE_ADVANCED_ANTISPOOFING = True
    TEXTURE_ANALYSIS_ENABLED = True
    REFLECTION_ANALYSIS_ENABLED = True
    MOTION_DEPTH_ANALYSIS_ENABLED = True
    
    # Database
    STORE_SESSION_DATA = True
    STORE_VERIFICATION_RECORDS = True
    AUTO_CLEANUP_EXPIRED_SESSIONS = True
    
    @classmethod
    def from_env(cls):
        """Load configuration from environment variables."""
        cls.SESSION_TIMEOUT_SECONDS = int(os.getenv('LIVENESS_SESSION_TIMEOUT', '300'))
        cls.TARGET_FPS = int(os.getenv('LIVENESS_TARGET_FPS', '30'))
        cls.ANALYSIS_DURATION_SECONDS = int(os.getenv('LIVENESS_ANALYSIS_DURATION', '5'))
        cls.LIVENESS_SCORE_THRESHOLD = float(os.getenv('LIVENESS_SCORE_THRESHOLD', '70.0'))
        cls.SPOOFING_RISK_THRESHOLD = float(os.getenv('SPOOFING_RISK_THRESHOLD', '0.6'))
        return cls
    
    @classmethod
    def to_dict(cls):
        """Convert to dictionary."""
        return {
            'SESSION_TIMEOUT_SECONDS': cls.SESSION_TIMEOUT_SECONDS,
            'TARGET_FPS': cls.TARGET_FPS,
            'ANALYSIS_DURATION_SECONDS': cls.ANALYSIS_DURATION_SECONDS,
            'LIVENESS_SCORE_THRESHOLD': cls.LIVENESS_SCORE_THRESHOLD,
            'SPOOFING_RISK_THRESHOLD': cls.SPOOFING_RISK_THRESHOLD,
            'ENABLE_CHALLENGES': cls.ENABLE_CHALLENGES,
            'NUM_CHALLENGES_REQUIRED': cls.NUM_CHALLENGES_REQUIRED
        }
