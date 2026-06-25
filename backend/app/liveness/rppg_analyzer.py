"""RPPG Analyzer — Layer 4: Remote Photoplethysmography."""
import numpy as np
from typing import List, Optional, Dict


class RPPGAnalyzer:
    """
    طبقة ٤: rPPG — Remote Photoplethysmography
    كشف نبضات الدم من تغيرات لون الجلد
    هذا ما يستخدمه iProov وFaceTec
    """

    # منطقة الجبهة — أفضل منطقة لقراءة rPPG
    FOREHEAD_LANDMARKS = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]

    def extract_forehead_signal(self, frames: List[np.ndarray], landmarks_history: list) -> Optional[np.ndarray]:
        """يستخرج إشارة اللون من منطقة الجبهة عبر كل الـ frames"""
        signals = []
        for frame, landmarks in zip(frames, landmarks_history):
            if landmarks is None:
                continue
            h, w = frame.shape[:2]
            # منطقة الجبهة المبسّطة — بين العينين والهامة
            forehead_y1 = int(landmarks[10].y * h) - 20
            forehead_y2 = int(landmarks[10].y * h) + 10
            forehead_x1 = int(landmarks[234].x * w)
            forehead_x2 = int(landmarks[454].x * w)
            if forehead_y1 < 0 or forehead_x1 < 0:
                continue
            roi = frame[max(0, forehead_y1):forehead_y2, max(0, forehead_x1):forehead_x2]
            if roi.size == 0:
                continue
            mean_rgb = np.mean(roi.reshape(-1, 3), axis=0)
            signals.append(mean_rgb)
        if len(signals) < 15:
            return None
        return np.array(signals)

    def detect_pulse(self, signal: np.ndarray) -> Dict:
        """
        يحلل إشارة اللون ويكشف نبضات القلب
        نبضات طبيعية: 50-150 bpm
        """
        if signal is None or len(signal) < 15:
            return {"has_pulse": False, "bpm": 0, "confidence": 0}

        # استخدم قناة G (الأكثر حساسية لنبضات الدم)
        green_channel = signal[:, 1]

        # normalize
        green_norm = green_channel - np.mean(green_channel)

        # FFT لاكتشاف التردد
        fps = 15  # افتراضي
        freqs = np.fft.fftfreq(len(green_norm), d=1.0/fps)
        fft_vals = np.abs(np.fft.fft(green_norm))

        # نطاق نبضات القلب: 0.8-2.5 Hz (48-150 bpm)
        valid_mask = (freqs >= 0.8) & (freqs <= 2.5)
        if not np.any(valid_mask):
            return {"has_pulse": False, "bpm": 0, "confidence": 0}

        valid_freqs = freqs[valid_mask]
        valid_fft = fft_vals[valid_mask]

        peak_idx = np.argmax(valid_fft)
        peak_freq = valid_freqs[peak_idx]
        peak_power = valid_fft[peak_idx]
        total_power = np.sum(valid_fft)

        bpm = peak_freq * 60
        confidence = float(peak_power / total_power) if total_power > 0 else 0

        has_pulse = (50 <= bpm <= 150) and confidence > 0.3

        return {
            "has_pulse": has_pulse,
            "bpm": float(bpm),
            "confidence": float(confidence)
        }
