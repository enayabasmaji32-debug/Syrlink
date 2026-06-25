"""Liveness Detection API — نظام التحقق من الوجه المتكامل.
يستبدل biometric.py القديم.
"""
import base64
import random
import time
import logging
import numpy as np
import cv2
from typing import Dict, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.security import get_current_user
from app.database import db
from app.liveness.anti_spoofing import AntiSpoofingEngine
from app.liveness.config import (
    LIVENESS_SCORE_THRESHOLD, CHALLENGE_DURATION_SECONDS,
    MAX_ATTEMPTS, ALLOWED_CHALLENGE_TYPES
)

log = logging.getLogger("syrlink.liveness")
router = APIRouter(prefix="/auth/liveness", tags=["liveness"])

_engine = AntiSpoofingEngine()
_sessions: Dict[str, Dict] = {}


class LivenessChallengeOut(BaseModel):
    session_id: str
    challenge: str
    instructions: str
    expires_in: int


class LivenessVerifyIn(BaseModel):
    session_id: str
    frames_base64: List[str]  # قائمة frames مرمّزة بـ base64


class LivenessVerifyOut(BaseModel):
    verified: bool
    score: float
    detail: str


def _cleanup_sessions():
    now = time.time()
    expired = [k for k, v in _sessions.items() if now - v["created_at"] > CHALLENGE_DURATION_SECONDS]
    for k in expired:
        del _sessions[k]

CHALLENGE_INSTRUCTIONS = {
    "blink": "ابقَ ثابتاً وارمش بشكل طبيعي",
    "turn_left": "حرّك رأسك ببطء ناحية اليسار ثم عد للمنتصف",
    "turn_right": "حرّك رأسك ببطء ناحية اليمين ثم عد للمنتصف",
    "smile": "ابتسم بشكل طبيعي",
    "nod": "حرّك رأسك للأعلى والأسفل ببطء",
}


@router.post("/challenge", response_model=LivenessChallengeOut)
async def create_challenge(current=Depends(get_current_user)):
    """يولّد تحدي عشوائي للمستخدم"""
    _cleanup_sessions()
    challenge = random.choice(ALLOWED_CHALLENGE_TYPES)
    session_id = f"{current['id']}_{int(time.time() * 1000)}"
    _sessions[session_id] = {
        "user_id": current["id"],
        "challenge": challenge,
        "created_at": time.time(),
        "attempts": 0,
    }
    return LivenessChallengeOut(
        session_id=session_id,
        challenge=challenge,
        instructions=CHALLENGE_INSTRUCTIONS[challenge],
        expires_in=CHALLENGE_DURATION_SECONDS,
    )


@router.post("/verify", response_model=LivenessVerifyOut)
async def verify_liveness(data: LivenessVerifyIn, current=Depends(get_current_user)):
    """يتحقق من الحياة عبر تحليل الفيديو"""
    session = _sessions.get(data.session_id)
    if not session:
        raise HTTPException(status_code=400, detail="جلسة غير صالحة أو منتهية")
    if session["user_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="الجلسة لا تخصك")
    if time.time() - session["created_at"] > CHALLENGE_DURATION_SECONDS:
        del _sessions[data.session_id]
        raise HTTPException(status_code=400, detail="انتهت صلاحية الجلسة")
    if session["attempts"] >= MAX_ATTEMPTS:
        del _sessions[data.session_id]
        raise HTTPException(status_code=429, detail="تجاوزت عدد المحاولات المسموح")

    session["attempts"] += 1

    # فكّ تشفير الـ frames
    if len(data.frames_base64) < 15:
        return LivenessVerifyOut(verified=False, score=0.0, detail="عدد الـ frames غير كافٍ — أرسل 15 على الأقل")

    frames = []
    for b64 in data.frames_base64[:60]:  # حد أقصى 60 frame
        try:
            img_bytes = base64.b64decode(b64.split(",")[-1])
            nparr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is not None:
                frames.append(frame)
        except Exception:
            continue

    if len(frames) < 15:
        return LivenessVerifyOut(verified=False, score=0.0, detail="تعذر فك تشفير الـ frames — تأكد من صحة الصور")

    try:
        result = _engine.analyze_video_frames(frames)
    except Exception as e:
        log.error(f"Liveness engine error: {e}")
        return LivenessVerifyOut(verified=False, score=0.0, detail="حدث خطأ أثناء التحليل")

    if result["verified"]:
        # نجح — احذف الجلسة
        del _sessions[data.session_id]
        # حدّث المستخدم في DB
        await db.users.update_one({"id": current["id"]}, {"$set": {"biometric_verified": True}})
        return LivenessVerifyOut(
            verified=True,
            score=result["score"],
            detail="تم التحقق بنجاح"
        )

    return LivenessVerifyOut(
        verified=False,
        score=result["score"],
        detail=result["reason"]
    )
