"""Face Analyzer — Layer 1: Face Detection + Validation."""
import cv2
import mediapipe as mp
import numpy as np
from typing import Dict


class FaceAnalyzer:
    """
    طبقة ١: Face Detection + Validation
    - يتحقق إن في وجه واحد بالضبط
    - يتحقق من حجم الوجه
    - يتحقق من الإضاءة
    """

    def __init__(self):
        self.mp_face_detection = mp.solutions.face_detection
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_detection = self.mp_face_detection.FaceDetection(
            min_detection_confidence=0.7
        )
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
        )

    def analyze_frame(self, frame: np.ndarray) -> Dict:
        """تحليل frame واحد — يرجع dict بكل المعلومات"""
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # كشف الوجه
        detection_results = self.face_detection.process(rgb)

        if not detection_results.detections:
            return {"valid": False, "reason": "no_face", "landmarks": None, "score": 0}

        if len(detection_results.detections) > 1:
            return {"valid": False, "reason": "multiple_faces", "landmarks": None, "score": 0}

        detection = detection_results.detections[0]
        confidence = detection.score[0]

        # تحقق من حجم الوجه
        bbox = detection.location_data.relative_bounding_box
        face_area = bbox.width * bbox.height
        if face_area < 0.0225:  # 15% * 15%
            return {"valid": False, "reason": "face_too_small", "landmarks": None, "score": confidence}

        # تحقق من الإضاءة
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        brightness = np.mean(gray)
        if brightness < 40:
            return {"valid": False, "reason": "too_dark", "landmarks": None, "score": confidence}
        if brightness > 240:
            return {"valid": False, "reason": "too_bright", "landmarks": None, "score": confidence}

        # استخراج landmarks
        mesh_results = self.face_mesh.process(rgb)
        landmarks = None
        if mesh_results.multi_face_landmarks:
            landmarks = mesh_results.multi_face_landmarks[0].landmark

        return {
            "valid": True,
            "reason": "ok",
            "landmarks": landmarks,
            "score": confidence,
            "brightness": brightness,
            "face_area": face_area
        }
