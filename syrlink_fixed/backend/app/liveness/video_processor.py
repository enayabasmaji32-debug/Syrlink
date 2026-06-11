"""
Real-time Video Processing Loop Module
Orchestrates all liveness detection components in a real-time loop
Processes 20-30 FPS video stream
"""

import cv2
import numpy as np
import threading
import time
from typing import Dict, Optional, Tuple, Callable
from collections import deque
import json

from .face_detector_tracker import FaceDetectorTracker
from .head_pose_estimator import HeadPoseEstimator
from .liveness_detector import LivenessDetector, LivenessState
from .anti_spoofing import AntiSpoofingDetector
from .challenge_manager import ChallengeManager


class VideoLivenessProcessor:
    """
    Main processor for real-time video liveness detection.
    Orchestrates all detection modules.
    """
    
    def __init__(self, enable_challenges: bool = True, 
                 target_fps: int = 30,
                 analysis_duration_sec: int = 5):
        """
        Initialize video processor.
        
        Args:
            enable_challenges: Whether to use active challenges
            target_fps: Target frames per second
            analysis_duration_sec: Duration of analysis in seconds
        """
        self.target_fps = target_fps
        self.frame_time = 1.0 / target_fps
        self.analysis_duration_frames = analysis_duration_sec * target_fps
        
        # Initialize detection modules
        self.face_detector = FaceDetectorTracker()
        self.head_pose_estimator = HeadPoseEstimator()
        self.liveness_detector = LivenessDetector(
            analysis_duration=int(self.analysis_duration_frames)
        )
        self.anti_spoofing_detector = AntiSpoofingDetector()
        self.challenge_manager = ChallengeManager() if enable_challenges else None
        
        # Processing state
        self.is_running = False
        self.frame_count = 0
        self.processing_thread = None
        
        # Results tracking
        self.current_result = None
        self.result_history = deque(maxlen=300)  # 10 seconds at 30fps
        
        # Callback for results
        self.result_callback = None
        
    def set_result_callback(self, callback: Callable[[Dict], None]):
        """Set callback function for results."""
        self.result_callback = callback
    
    def process_frame(self, frame: np.ndarray) -> Dict:
        """
        Process single video frame through all detection modules.
        
        Args:
            frame: Input video frame (BGR format)
            
        Returns:
            Dictionary with comprehensive liveness analysis results
        """
        self.frame_count += 1
        start_time = time.time()
        
        # 1. Face Detection and Tracking
        face_info = self.face_detector.track_face(frame)
        
        if face_info is None:
            result = {
                'frame': self.frame_count,
                'face_detected': False,
                'status': 'NO_FACE',
                'timestamp': start_time
            }
            self.current_result = result
            return result
        
        face_bbox = face_info['bbox']
        
        # 2. Extract facial landmarks
        landmarks_2d = self.face_detector.get_face_landmarks_simple(frame, face_bbox)
        
        # 3. Estimate head pose
        head_pose = self.head_pose_estimator.estimate_head_pose(landmarks_2d, face_bbox)
        
        # 4. Liveness Analysis
        liveness_result = self.liveness_detector.analyze_frame(
            landmarks_2d, face_bbox, head_pose, frame
        )
        
        # 5. Anti-spoofing Analysis
        spoofing_result = self.anti_spoofing_detector.analyze_frame(
            frame, face_bbox, landmarks_2d, head_pose
        )
        
        # 6. Active Challenges (if enabled)
        challenge_result = None
        if self.challenge_manager:
            challenge_result = self.challenge_manager.update(head_pose, landmarks_2d)
        
        # 7. Determine overall liveness status
        overall_status = self._determine_overall_status(
            liveness_result, spoofing_result, challenge_result
        )
        
        # 8. Calculate confidence score
        confidence = self._calculate_confidence(
            liveness_result, spoofing_result, challenge_result
        )
        
        # Compile results
        result = {
            'frame': self.frame_count,
            'face_detected': True,
            'status': overall_status,
            'confidence': confidence,
            'face_bbox': face_bbox,
            'head_pose': head_pose,
            'liveness': liveness_result,
            'anti_spoofing': spoofing_result,
            'challenges': challenge_result,
            'motion': self.face_detector.get_motion_vector(),
            'tracking_stability': self.face_detector.get_tracking_stability(),
            'processing_time_ms': (time.time() - start_time) * 1000,
            'timestamp': start_time
        }
        
        # Store result
        self.current_result = result
        self.result_history.append(result)
        
        # Call callback if set
        if self.result_callback:
            self.result_callback(result)
        
        return result
    
    def process_video_stream(self, video_source: int | str, 
                           output_video: Optional[str] = None,
                           max_frames: Optional[int] = None) -> Dict:
        """
        Process video stream from camera or file.
        
        Args:
            video_source: Camera index (0 for default) or video file path
            output_video: Optional path to save output video with visualizations
            max_frames: Maximum frames to process (None for unlimited)
            
        Returns:
            Final comprehensive liveness assessment
        """
        cap = cv2.VideoCapture(video_source)
        
        if not cap.isOpened():
            return {
                'error': 'Could not open video source',
                'success': False
            }
        
        # Get video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        # Setup video writer if output specified
        writer = None
        if output_video:
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            writer = cv2.VideoWriter(output_video, fourcc, fps, (width, height))
        
        frame_count = 0
        last_time = time.time()
        
        try:
            while True:
                ret, frame = cap.read()
                
                if not ret:
                    break
                
                # Process frame
                result = self.process_frame(frame)
                
                # Draw visualizations
                if result.get('face_detected'):
                    frame = self._draw_visualizations(frame, result)
                else:
                    cv2.putText(frame, 'NO FACE DETECTED', (50, 50),
                              cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                
                # Write output video
                if writer:
                    writer.write(frame)
                
                # Display frame
                cv2.imshow('Liveness Detection', frame)
                
                # FPS regulation
                elapsed = time.time() - last_time
                sleep_time = max(0, self.frame_time - elapsed)
                time.sleep(sleep_time)
                last_time = time.time()
                
                frame_count += 1
                
                # Check max frames limit
                if max_frames and frame_count >= max_frames:
                    break
                
                # Exit on 'q' key
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
        
        finally:
            cap.release()
            if writer:
                writer.release()
            cv2.destroyAllWindows()
        
        # Generate final assessment
        assessment = self._generate_final_assessment()
        
        return assessment
    
    def _draw_visualizations(self, frame: np.ndarray, result: Dict) -> np.ndarray:
        """
        Draw detection visualizations on frame.
        """
        if not result.get('face_detected'):
            return frame
        
        # Draw face bounding box
        bbox = result.get('face_bbox')
        if bbox:
            x, y, w, h = bbox
            cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
        
        # Draw head pose
        head_pose = result.get('head_pose', {})
        yaw = head_pose.get('yaw', 0)
        pitch = head_pose.get('pitch', 0)
        
        text = f"Yaw: {yaw:.1f}° Pitch: {pitch:.1f}°"
        cv2.putText(frame, text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 
                   0.7, (255, 255, 255), 2)
        
        # Draw liveness score
        liveness = result.get('liveness', {})
        liveness_score = liveness.get('liveness_score', 0)
        cv2.putText(frame, f"Liveness: {liveness_score:.1f}", (10, 70),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        # Draw spoofing risk
        spoofing = result.get('anti_spoofing', {})
        spoofing_risk = spoofing.get('spoofing_risk', 0)
        risk_color = (0, 0, 255) if spoofing_risk > 0.5 else (0, 255, 0)
        cv2.putText(frame, f"Spoofing Risk: {spoofing_risk:.2f}", (10, 110),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, risk_color, 2)
        
        # Draw status
        status = result.get('status', 'UNKNOWN')
        status_color = (0, 255, 0) if status == 'LIVENESS_CONFIRMED' else (0, 0, 255)
        cv2.putText(frame, f"Status: {status}", (10, 150),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, status_color, 2)
        
        # Draw challenges if enabled
        if result.get('challenges'):
            challenges = result['challenges']
            challenge_text = f"Challenge: {challenges.get('current_challenge', 'N/A')}"
            progress = challenges.get('challenge_progress', 0)
            cv2.putText(frame, f"{challenge_text} ({progress:.1%})", (10, 190),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
        
        # Draw confidence
        confidence = result.get('confidence', 0)
        cv2.putText(frame, f"Confidence: {confidence:.1%}", (10, frame.shape[0] - 20),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 2)
        
        return frame
    
    def _determine_overall_status(self, liveness_result: Dict,
                                 spoofing_result: Dict,
                                 challenge_result: Optional[Dict]) -> str:
        """
        Determine overall liveness status.
        """
        # Check for spoofing
        if spoofing_result.get('is_spoofed', False):
            return 'SPOOFING_DETECTED'
        
        spoofing_risk = spoofing_result.get('spoofing_risk', 0)
        if spoofing_risk > 0.7:
            return 'HIGH_SPOOFING_RISK'
        
        # Check for liveness
        liveness_score = liveness_result.get('liveness_score', 0)
        
        if liveness_score > 80:
            # Check challenges if enabled
            if challenge_result:
                if challenge_result.get('all_challenges_completed', False):
                    return 'LIVENESS_CONFIRMED'
                else:
                    return 'CHALLENGES_PENDING'
            else:
                return 'LIVENESS_CONFIRMED'
        
        elif liveness_score > 50:
            return 'LIVENESS_UNCERTAIN'
        
        elif liveness_score > 20:
            return 'LOW_LIVENESS'
        
        else:
            return 'LIKELY_SPOOFED'
    
    def _calculate_confidence(self, liveness_result: Dict,
                            spoofing_result: Dict,
                            challenge_result: Optional[Dict]) -> float:
        """
        Calculate overall confidence score (0-1).
        """
        confidence = 0.0
        
        # Liveness component (40%)
        liveness_score = liveness_result.get('liveness_score', 0) / 100
        confidence += liveness_score * 0.4
        
        # Anti-spoofing component (30%)
        spoofing_risk = spoofing_result.get('spoofing_risk', 0)
        anti_spoofing_confidence = 1.0 - spoofing_risk
        confidence += anti_spoofing_confidence * 0.3
        
        # Challenge component (30%)
        if challenge_result:
            challenge_progress = challenge_result.get('overall_progress', 0)
            confidence += challenge_progress * 0.3
        else:
            confidence += 0.3  # Give benefit if no challenges
        
        return np.clip(confidence, 0, 1)
    
    def _generate_final_assessment(self) -> Dict:
        """
        Generate final liveness assessment from all results.
        """
        if not self.result_history:
            return {
                'success': False,
                'error': 'No frames processed',
                'assessment': 'INSUFFICIENT_DATA'
            }
        
        # Aggregate results
        statuses = [r.get('status', 'UNKNOWN') for r in self.result_history]
        confidences = [r.get('confidence', 0) for r in self.result_history]
        liveness_scores = [r.get('liveness', {}).get('liveness_score', 0) 
                          for r in self.result_history]
        spoofing_risks = [r.get('anti_spoofing', {}).get('spoofing_risk', 0) 
                         for r in self.result_history]
        
        # Calculate statistics
        avg_confidence = np.mean(confidences)
        avg_liveness = np.mean(liveness_scores)
        avg_spoofing_risk = np.mean(spoofing_risks)
        max_liveness = np.max(liveness_scores)
        
        # Determine final assessment
        if avg_spoofing_risk > 0.7:
            final_status = 'SPOOFING_DETECTED'
            success = False
        elif max_liveness > 80 and avg_liveness > 60:
            final_status = 'LIVENESS_CONFIRMED'
            success = True
        elif avg_liveness > 50:
            final_status = 'LIKELY_GENUINE'
            success = True
        else:
            final_status = 'UNABLE_TO_CONFIRM'
            success = False
        
        assessment = {
            'success': success,
            'final_status': final_status,
            'total_frames_processed': len(self.result_history),
            'average_confidence': float(avg_confidence),
            'average_liveness_score': float(avg_liveness),
            'average_spoofing_risk': float(avg_spoofing_risk),
            'max_liveness_score': float(max_liveness),
            'status_distribution': self._get_status_distribution(statuses)
        }
        
        return assessment
    
    def _get_status_distribution(self, statuses: list) -> Dict[str, int]:
        """Get distribution of status values."""
        distribution = {}
        for status in statuses:
            distribution[status] = distribution.get(status, 0) + 1
        return distribution
    
    def reset(self):
        """Reset all detection modules."""
        self.face_detector.reset()
        self.head_pose_estimator.reset()
        self.liveness_detector.reset()
        self.anti_spoofing_detector.reset()
        if self.challenge_manager:
            self.challenge_manager.reset()
        
        self.frame_count = 0
        self.current_result = None
        self.result_history.clear()
