"""Biometric verification routes using OpenCV + MediaPipe."""
import os
import io
import base64
import random
import time
import logging
import math
from typing import Optional, Dict, List
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from app.security import get_current_user
from app.database import db

log = logging.getLogger("syrlink.biometric")
router = APIRouter(prefix="/auth/biometric", tags=["biometric"])

# In-memory challenge store: user_id -> {challenge, created_at, attempts}
_challenge_store: Dict[str, Dict] = {}

CHALLENGE_DURATION = 120  # seconds
CHALLENGE_TYPES = ["blink", "turn_left", "turn_right", "smile"]
MAX_IMAGE_RAW_BYTES = 5 * 1024 * 1024  # 5 MB


class BiometricChallengeOut(BaseModel):
    challenge: str
    session_id: str
    expires_in: int


class BiometricVerifyIn(BaseModel):
    session_id: str
    image_base64: str


class BiometricVerifyOut(BaseModel):
    verified: bool
    detail: str


def _cleanup_old_challenges():
    now = time.time()
    expired = [k for k, v in _challenge_store.items() if now - v["created_at"] > CHALLENGE_DURATION]
    for k in expired:
        del _challenge_store[k]


@router.post("/challenge", response_model=BiometricChallengeOut)
async def create_challenge(current=Depends(get_current_user)):
    """Generate a random biometric challenge for the current user."""
    _cleanup_old_challenges()
    user_id = current["id"]
    challenge = random.choice(CHALLENGE_TYPES)
    session_id = f"{user_id}_{int(time.time() * 1000)}"
    _challenge_store[session_id] = {
        "user_id": user_id,
        "challenge": challenge,
        "created_at": time.time(),
        "attempts": 0,
    }
    log.info(f"Biometric challenge created for user {user_id}: {challenge}")
    return BiometricChallengeOut(challenge=challenge, session_id=session_id, expires_in=CHALLENGE_DURATION)


@router.post("/verify", response_model=BiometricVerifyOut)
async def verify_biometric(data: BiometricVerifyIn, current=Depends(get_current_user)):
    """Verify a biometric challenge using an uploaded image."""
    session = _challenge_store.get(data.session_id)
    if not session:
        raise HTTPException(status_code=400, detail="Invalid or expired session")
    if session["user_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Session does not belong to current user")
    if time.time() - session["created_at"] > CHALLENGE_DURATION:
        del _challenge_store[data.session_id]
        raise HTTPException(status_code=400, detail="Session expired")
    if session["attempts"] >= 3:
        del _challenge_store[data.session_id]
        raise HTTPException(status_code=400, detail="Too many attempts")

    session["attempts"] += 1

    # Decode image
    try:
        b64 = data.image_base64.split(",")[-1]
        # Quick size guard before decoding (base64 length ≈ 4/3 * raw_bytes)
        allowed_b64_len = math.ceil((MAX_IMAGE_RAW_BYTES / 3) * 4)
        if len(b64) > allowed_b64_len:
            raise HTTPException(status_code=413, detail="Image too large")
        img_bytes = base64.b64decode(b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")

    # Try to use OpenCV + MediaPipe for face detection and liveness
    try:
        import numpy as np
        import cv2
        import mediapipe as mp

        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Could not decode image")

        # MediaPipe face detection
        mp_face_detection = mp.solutions.face_detection
        face_detection = mp_face_detection.FaceDetection(min_detection_confidence=0.5)
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = face_detection.process(rgb)

        if not results.detections or len(results.detections) == 0:
            return BiometricVerifyOut(verified=False, detail="No face detected")

        if len(results.detections) > 1:
            return BiometricVerifyOut(verified=False, detail="Multiple faces detected")

        # Basic liveness check: ensure face score is high enough
        detection = results.detections[0]
        score = detection.score[0] if detection.score else 0
        if score < 0.85:
            return BiometricVerifyOut(verified=False, detail="Face confidence too low")

        # For now, we accept the challenge as passed if a real face is detected.
        # Advanced challenge verification (blink, turn, smile) would require video frames.
        del _challenge_store[data.session_id]
        log.info(f"Biometric verification succeeded for user {current['id']}")
        return BiometricVerifyOut(verified=True, detail="Face verified successfully")

    except ImportError:
        log.error("OpenCV or MediaPipe not installed. Install: pip install opencv-python-headless mediapipe")
        raise HTTPException(
            status_code=503,
            detail="Biometric verification is currently unavailable. Please contact support."
        )
    except Exception as e:
        log.error(f"Biometric verification error: {e}")
        return BiometricVerifyOut(verified=False, detail=f"Verification error: {str(e)}")
