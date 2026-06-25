"""Motion Analyzer — Layers 2+3: Micro-Motion + Blink Detection."""
import numpy as np
from typing import List


class MotionAnalyzer:
    """
    طبقة ٢+٣: Micro-Motion + Blink Detection
    - يحلل الحركات الدقيقة اللاإرادية
    - يكشف الرمش الطبيعي للعين
    - يكشف حركة الرأس
    """

    # MediaPipe face mesh indices
    LEFT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
    RIGHT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
    LEFT_EYE_TOP = [386, 387, 388]
    LEFT_EYE_BOTTOM = [374, 380, 381]
    RIGHT_EYE_TOP = [159, 160, 161]
    RIGHT_EYE_BOTTOM = [145, 153, 144]

    def calculate_ear(self, landmarks, eye_top_ids: list, eye_bottom_ids: list) -> float:
        """Eye Aspect Ratio — نسبة انفتاح العين"""
        if not landmarks:
            return 0.3
        top_pts = np.array([[landmarks[i].x, landmarks[i].y] for i in eye_top_ids])
        bottom_pts = np.array([[landmarks[i].x, landmarks[i].y] for i in eye_bottom_ids])
        vertical = np.mean(np.linalg.norm(top_pts - bottom_pts, axis=1))
        left_corner = np.array([landmarks[self.LEFT_EYE[0]].x, landmarks[self.LEFT_EYE[0]].y])
        right_corner = np.array([landmarks[self.LEFT_EYE[8]].x, landmarks[self.LEFT_EYE[8]].y])
        horizontal = np.linalg.norm(left_corner - right_corner)
        if horizontal == 0:
            return 0.3
        return vertical / horizontal

    def detect_blink(self, ear_history: List[float]) -> bool:
        """يكشف إذا صار رمش حقيقي في تاريخ الـ EAR"""
        if len(ear_history) < 3:
            return False
        EAR_THRESHOLD = 0.21
        for i in range(1, len(ear_history) - 1):
            if ear_history[i] < EAR_THRESHOLD and ear_history[i-1] > EAR_THRESHOLD:
                return True
        return False

    def calculate_head_movement(self, landmarks_history: list) -> float:
        """يحسب مقدار حركة الرأس عبر الـ frames — نقطة الأنف كمرجع"""
        if len(landmarks_history) < 2:
            return 0.0
        nose_positions = []
        for landmarks in landmarks_history:
            if landmarks:
                nose_positions.append((landmarks[1].x, landmarks[1].y))
        if len(nose_positions) < 2:
            return 0.0
        movements = []
        for i in range(1, len(nose_positions)):
            dx = nose_positions[i][0] - nose_positions[i-1][0]
            dy = nose_positions[i][1] - nose_positions[i-1][1]
            movements.append(np.sqrt(dx**2 + dy**2))
        return float(np.mean(movements))

    def has_micro_motion(self, landmarks_history: list) -> bool:
        """يتحقق من وجود حركات دقيقة لاإرادية — علامة الحياة"""
        movement = self.calculate_head_movement(landmarks_history)
        # حركة صغيرة جداً تدل على صورة ثابتة، كبيرة جداً تدل على فيديو مزيّف
        return 0.0003 < movement < 0.05
