"""Liveness detection configuration."""

# Thresholds
LIVENESS_SCORE_THRESHOLD = 0.92
RPPG_MIN_FRAMES = 30
CHALLENGE_DURATION_SECONDS = 120
MAX_ATTEMPTS = 3
MIN_FACE_SIZE_RATIO = 0.15  # وجه لازم يكون 15% من الإطار على الأقل
ALLOWED_CHALLENGE_TYPES = ["blink", "turn_left", "turn_right", "smile", "nod"]
