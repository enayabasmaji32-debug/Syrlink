"""
Database Models for Liveness Detection Results
SQLAlchemy models for storing verification sessions and results
"""

from datetime import datetime
from app.database import db
import json


class LivenessSession(db.Model):
    """
    Stores liveness detection session information.
    """
    __tablename__ = 'liveness_sessions'
    
    id = db.Column(db.String(36), primary_key=True)  # UUID
    user_id = db.Column(db.String(255), nullable=False, index=True)
    session_type = db.Column(db.String(50), default='verification')  # verification, registration, re-verification
    
    # Session timing
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    duration_seconds = db.Column(db.Float)
    
    # Processing info
    total_frames = db.Column(db.Integer, default=0)
    fps = db.Column(db.Integer, default=30)
    
    # Status
    status = db.Column(db.String(50), default='active')  # active, completed, timeout, error
    error_message = db.Column(db.Text)
    
    # Results
    final_status = db.Column(db.String(100))  # LIVENESS_CONFIRMED, SPOOFING_DETECTED, etc
    confidence = db.Column(db.Float)  # 0.0 to 1.0
    liveness_score = db.Column(db.Float)  # 0.0 to 100.0
    spoofing_risk = db.Column(db.Float)  # 0.0 to 1.0
    
    # Challenge info
    challenges_enabled = db.Column(db.Boolean, default=True)
    challenges_completed = db.Column(db.Boolean, default=False)
    challenges_data = db.Column(db.JSON)
    
    # Verification result
    is_live = db.Column(db.Boolean)  # Final determination
    
    # Additional data
    device_info = db.Column(db.JSON)  # Browser, OS, camera info
    location_data = db.Column(db.JSON)  # IP, geolocation
    metadata = db.Column(db.JSON)  # Custom metadata
    
    # Relationships
    frames = db.relationship('LivenessFrame', backref='session', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<LivenessSession {self.id}>'
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'session_type': self.session_type,
            'created_at': self.created_at.isoformat(),
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'duration_seconds': self.duration_seconds,
            'total_frames': self.total_frames,
            'status': self.status,
            'final_status': self.final_status,
            'confidence': self.confidence,
            'liveness_score': self.liveness_score,
            'spoofing_risk': self.spoofing_risk,
            'is_live': self.is_live,
            'challenges_completed': self.challenges_completed
        }


class LivenessFrame(db.Model):
    """
    Stores individual frame analysis results.
    """
    __tablename__ = 'liveness_frames'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(36), db.ForeignKey('liveness_sessions.id'), nullable=False, index=True)
    
    # Frame info
    frame_number = db.Column(db.Integer)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    # Detection results
    face_detected = db.Column(db.Boolean)
    face_bbox = db.Column(db.JSON)  # [x, y, w, h]
    
    # Head pose
    yaw = db.Column(db.Float)
    pitch = db.Column(db.Float)
    roll = db.Column(db.Float)
    
    # Liveness indicators
    liveness_score = db.Column(db.Float)
    motion_magnitude = db.Column(db.Float)
    tracking_stability = db.Column(db.Float)
    
    # Anti-spoofing
    spoofing_risk = db.Column(db.Float)
    printed_image_score = db.Column(db.Float)
    screen_display_score = db.Column(db.Float)
    
    # Challenge info
    current_challenge = db.Column(db.String(100))
    challenge_progress = db.Column(db.Float)
    
    # Status
    status = db.Column(db.String(100))  # ANALYZING, LIVENESS_CONFIRMED, etc
    confidence = db.Column(db.Float)
    
    # Timing
    processing_time_ms = db.Column(db.Float)
    
    def __repr__(self):
        return f'<LivenessFrame {self.id}>'
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'frame_number': self.frame_number,
            'face_detected': self.face_detected,
            'yaw': self.yaw,
            'pitch': self.pitch,
            'roll': self.roll,
            'liveness_score': self.liveness_score,
            'spoofing_risk': self.spoofing_risk,
            'status': self.status,
            'confidence': self.confidence
        }


class LivenessVerification(db.Model):
    """
    Stores final liveness verification records for audit trail.
    """
    __tablename__ = 'liveness_verifications'
    
    id = db.Column(db.String(36), primary_key=True)  # UUID
    
    # User and session info
    user_id = db.Column(db.String(255), nullable=False, index=True)
    session_id = db.Column(db.String(36), db.ForeignKey('liveness_sessions.id'), nullable=False)
    
    # Verification details
    verification_type = db.Column(db.String(50))  # registration, login, update
    verified_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    # Result
    is_verified = db.Column(db.Boolean, nullable=False)
    verification_status = db.Column(db.String(100))
    verification_confidence = db.Column(db.Float)
    
    # Context
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.Text)
    device_fingerprint = db.Column(db.String(255))
    
    # Audit info
    verified_by_system = db.Column(db.Boolean, default=True)
    verified_by_admin = db.Column(db.String(255))  # Admin ID if manually verified
    notes = db.Column(db.Text)
    
    # Additional data
    metadata = db.Column(db.JSON)
    
    def __repr__(self):
        return f'<LivenessVerification {self.id}>'
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'verified_at': self.verified_at.isoformat(),
            'is_verified': self.is_verified,
            'verification_status': self.verification_status,
            'verification_confidence': self.verification_confidence,
            'verification_type': self.verification_type
        }


def create_liveness_tables():
    """Create all liveness detection tables."""
    db.create_all()


def get_session_statistics(user_id: str, days: int = 30):
    """
    Get liveness verification statistics for a user.
    """
    from datetime import timedelta
    
    start_date = datetime.utcnow() - timedelta(days=days)
    
    verifications = LivenessVerification.query.filter(
        LivenessVerification.user_id == user_id,
        LivenessVerification.verified_at >= start_date
    ).all()
    
    total = len(verifications)
    successful = sum(1 for v in verifications if v.is_verified)
    failed = total - successful
    
    return {
        'total_verifications': total,
        'successful_verifications': successful,
        'failed_verifications': failed,
        'success_rate': (successful / total * 100) if total > 0 else 0,
        'period_days': days
    }
