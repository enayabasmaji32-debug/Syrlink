"""Anti-Spoofing Engine — Layer 5: Complete engine."""
import numpy as np
from typing import Dict, List

from app.liveness.face_analyzer import FaceAnalyzer
from app.liveness.motion_analyzer import MotionAnalyzer
from app.liveness.rppg_analyzer import RPPGAnalyzer


class AntiSpoofingEngine:
    """
    طبقة ٥: محرك Anti-Spoofing الكامل
    يجمع كل الطبقات ويعطي score نهائي
    """

    def __init__(self):
        self.face_analyzer = FaceAnalyzer()
        self.motion_analyzer = MotionAnalyzer()
        self.rppg_analyzer = RPPGAnalyzer()

    def analyze_video_frames(self, frames: List[np.ndarray]) -> Dict:
        """
        يحلل مجموعة frames ويرجع نتيجة شاملة

        المدخل: قائمة frames من الفيديو
        المخرج: {
            score: float 0-1,
            verified: bool,
            details: dict,
            reason: str
        }
        """
        if len(frames) < 15:
            return {"score": 0, "verified": False, "reason": "insufficient_frames", "details": {}}

        # تحليل كل frame
        frame_results = [self.face_analyzer.analyze_frame(f) for f in frames]
        valid_frames = [r for r in frame_results if r["valid"]]

        # لازم 70% من الـ frames صالحة
        validity_ratio = len(valid_frames) / len(frames)
        if validity_ratio < 0.7:
            reasons = [r["reason"] for r in frame_results if not r["valid"]]
            most_common = max(set(reasons), key=reasons.count) if reasons else "unknown"
            return {"score": 0, "verified": False, "reason": most_common, "details": {"validity_ratio": validity_ratio}}

        # استخراج landmarks history
        landmarks_history = [r.get("landmarks") for r in frame_results]

        # طبقة ١: face detection score
        avg_face_score = float(np.mean([r["score"] for r in valid_frames]))

        # طبقة ٢: micro-motion
        has_micro_motion = self.motion_analyzer.has_micro_motion(landmarks_history)

        # طبقة ٣: blink detection
        ear_history = []
        for r in frame_results:
            if r["landmarks"]:
                ear = self.motion_analyzer.calculate_ear(
                    r["landmarks"],
                    self.motion_analyzer.LEFT_EYE_TOP,
                    self.motion_analyzer.LEFT_EYE_BOTTOM
                )
                ear_history.append(ear)
        has_blink = self.motion_analyzer.detect_blink(ear_history)

        # طبقة ٤: rPPG
        rppg_signal = self.rppg_analyzer.extract_forehead_signal(frames, landmarks_history)
        pulse_result = self.rppg_analyzer.detect_pulse(rppg_signal)

        # حساب الـ score النهائي
        score = 0.0
        score += avg_face_score * 0.25          # 25% وزن كشف الوجه
        score += (0.25 if has_micro_motion else 0)   # 25% حركة دقيقة
        score += (0.25 if has_blink else 0)          # 25% رمش
        score += pulse_result["confidence"] * 0.25   # 25% نبض دم

        from app.liveness.config import LIVENESS_SCORE_THRESHOLD
        verified = score >= LIVENESS_SCORE_THRESHOLD

        return {
            "score": round(score, 4),
            "verified": verified,
            "reason": "verified" if verified else "liveness_check_failed",
            "details": {
                "face_score": avg_face_score,
                "has_micro_motion": has_micro_motion,
                "has_blink": has_blink,
                "pulse": pulse_result,
                "valid_frames": len(valid_frames),
                "total_frames": len(frames),
            }
        }
