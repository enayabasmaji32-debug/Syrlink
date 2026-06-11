"""
Liveness Detection API Service
API integration layer for liveness detection
"""

import base64
import io
import json
import threading
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta
import cv2
import numpy as np

from .video_processor import VideoLivenessProcessor


class LivenessDetectionService:
    """
    Service for handling liveness detection via API.
    Manages detection sessions and results.
    """
    
    def __init__(self, max_session_duration: int = 300, enable_challenges: bool = True):
        """
        Initialize liveness detection service.
        
        Args:
            max_session_duration: Maximum session duration in seconds
            enable_challenges: Whether to use active challenges
        """
        self.max_session_duration = max_session_duration
        self.enable_challenges = enable_challenges
        
        # Active sessions
        self.sessions = {}
        self.session_lock = threading.Lock()
        
    def create_session(self, session_id: str) -> Dict:
        """
        Create new liveness detection session.
        
        Args:
            session_id: Unique session identifier
            
        Returns:
            Session initialization data
        """
        with self.session_lock:
            if session_id in self.sessions:
                return {
                    'success': False,
                    'error': 'Session already exists'
                }
            
            processor = VideoLivenessProcessor(
                enable_challenges=self.enable_challenges
            )
            
            self.sessions[session_id] = {
                'processor': processor,
                'created_at': datetime.now(),
                'frames_processed': 0,
                'results': [],
                'status': 'active',
                'challenge_instruction': None
            }
            
            # Set initial challenge instruction if enabled
            if self.enable_challenges:
                self.sessions[session_id]['challenge_instruction'] = \
                    processor.challenge_manager.get_challenge_instruction()
            
            return {
                'success': True,
                'session_id': session_id,
                'challenge_instruction': self.sessions[session_id]['challenge_instruction']
            }
    
    def process_frame(self, session_id: str, frame_data: str) -> Dict:
        """
        Process single video frame for liveness detection.
        
        Args:
            session_id: Session identifier
            frame_data: Base64-encoded frame image
            
        Returns:
            Frame processing results
        """
        with self.session_lock:
            if session_id not in self.sessions:
                return {
                    'success': False,
                    'error': 'Session not found'
                }
            
            session = self.sessions[session_id]
            
            # Check session timeout
            elapsed = (datetime.now() - session['created_at']).total_seconds()
            if elapsed > self.max_session_duration:
                session['status'] = 'timeout'
                return {
                    'success': False,
                    'error': 'Session timeout'
                }
            
            try:
                # Decode frame
                frame_bytes = base64.b64decode(frame_data)
                frame_array = np.frombuffer(frame_bytes, dtype=np.uint8)
                frame = cv2.imdecode(frame_array, cv2.IMREAD_COLOR)
                
                if frame is None:
                    return {
                        'success': False,
                        'error': 'Invalid frame data'
                    }
                
                # Process frame
                processor = session['processor']
                result = processor.process_frame(frame)
                
                # Store result
                session['frames_processed'] += 1
                session['results'].append(result)
                
                # Update challenge instruction
                if self.enable_challenges and result.get('challenges'):
                    challenges = result['challenges']
                    new_challenge = challenges.get('current_challenge')
                    if new_challenge and new_challenge != session.get('current_challenge'):
                        session['current_challenge'] = new_challenge
                        session['challenge_instruction'] = \
                            processor.challenge_manager.get_challenge_instruction()
                
                # Prepare response
                response = {
                    'success': True,
                    'frame': result.get('frame'),
                    'face_detected': result.get('face_detected'),
                    'status': result.get('status'),
                    'confidence': result.get('confidence'),
                    'liveness_score': result.get('liveness', {}).get('liveness_score'),
                    'spoofing_risk': result.get('anti_spoofing', {}).get('spoofing_risk'),
                    'challenge_instruction': session['challenge_instruction'],
                    'head_pose': result.get('head_pose'),
                    'processing_time_ms': result.get('processing_time_ms')
                }
                
                # Add challenge info if available
                if result.get('challenges'):
                    response['challenge_info'] = {
                        'current_challenge': result['challenges'].get('current_challenge'),
                        'progress': result['challenges'].get('challenge_progress'),
                        'overall_progress': result['challenges'].get('overall_progress'),
                        'completed': result['challenges'].get('all_challenges_completed')
                    }
                
                return response
                
            except Exception as e:
                return {
                    'success': False,
                    'error': str(e)
                }
    
    def get_session_result(self, session_id: str) -> Dict:
        """
        Get final liveness detection result for session.
        
        Args:
            session_id: Session identifier
            
        Returns:
            Final liveness assessment
        """
        with self.session_lock:
            if session_id not in self.sessions:
                return {
                    'success': False,
                    'error': 'Session not found'
                }
            
            session = self.sessions[session_id]
            processor = session['processor']
            
            # Generate final assessment
            assessment = processor._generate_final_assessment()
            
            assessment.update({
                'session_id': session_id,
                'frames_processed': session['frames_processed'],
                'duration_seconds': (datetime.now() - session['created_at']).total_seconds()
            })
            
            return {
                'success': True,
                'assessment': assessment
            }
    
    def close_session(self, session_id: str) -> Dict:
        """
        Close liveness detection session.
        
        Args:
            session_id: Session identifier
            
        Returns:
            Session closing result
        """
        with self.session_lock:
            if session_id not in self.sessions:
                return {
                    'success': False,
                    'error': 'Session not found'
                }
            
            session = self.sessions[session_id]
            session['status'] = 'closed'
            
            # Get final result
            processor = session['processor']
            processor.reset()
            
            return {
                'success': True,
                'session_id': session_id,
                'frames_processed': session['frames_processed']
            }
    
    def get_session_info(self, session_id: str) -> Dict:
        """
        Get current session information.
        
        Args:
            session_id: Session identifier
            
        Returns:
            Session information
        """
        with self.session_lock:
            if session_id not in self.sessions:
                return {
                    'success': False,
                    'error': 'Session not found'
                }
            
            session = self.sessions[session_id]
            
            return {
                'success': True,
                'session_id': session_id,
                'status': session['status'],
                'frames_processed': session['frames_processed'],
                'duration_seconds': (datetime.now() - session['created_at']).total_seconds(),
                'challenge_instruction': session['challenge_instruction']
            }
    
    def cleanup_expired_sessions(self):
        """Clean up expired sessions."""
        with self.session_lock:
            expired = []
            now = datetime.now()
            
            for session_id, session in self.sessions.items():
                elapsed = (now - session['created_at']).total_seconds()
                if elapsed > self.max_session_duration:
                    expired.append(session_id)
            
            for session_id in expired:
                del self.sessions[session_id]
            
            return len(expired)
    
    def get_active_sessions_count(self) -> int:
        """Get number of active sessions."""
        with self.session_lock:
            return len(self.sessions)


# Global service instance
_liveness_service: Optional[LivenessDetectionService] = None


def get_liveness_service(enable_challenges: bool = True) -> LivenessDetectionService:
    """
    Get or create global liveness detection service.
    """
    global _liveness_service
    
    if _liveness_service is None:
        _liveness_service = LivenessDetectionService(enable_challenges=enable_challenges)
    
    return _liveness_service
