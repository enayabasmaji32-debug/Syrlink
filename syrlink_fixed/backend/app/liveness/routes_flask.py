"""
Liveness Detection API Routes (Flask)
REST API endpoints for liveness detection
"""

from flask import Blueprint, request, jsonify
import uuid
import logging

from app.liveness.api_service import get_liveness_service

# Create blueprint
liveness_bp = Blueprint('liveness', __name__, url_prefix='/api/liveness')

logger = logging.getLogger(__name__)


@liveness_bp.route('/session/create', methods=['POST'])
def create_session():
    """
    Create new liveness detection session.
    
    Request JSON:
        {
            "enable_challenges": bool (optional, default: true)
        }
    
    Response:
        {
            "success": bool,
            "session_id": str,
            "challenge_instruction": str (optional)
        }
    """
    try:
        data = request.get_json() or {}
        
        # Generate session ID
        session_id = str(uuid.uuid4())
        
        # Get service
        service = get_liveness_service(
            enable_challenges=data.get('enable_challenges', True)
        )
        
        # Create session
        result = service.create_session(session_id)
        
        return jsonify(result), 200
    
    except Exception as e:
        logger.error(f"Error creating session: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@liveness_bp.route('/session/<session_id>/frame', methods=['POST'])
def process_frame(session_id):
    """
    Process video frame for liveness detection.
    
    Request JSON:
        {
            "frame": base64_encoded_image_string
        }
    
    Response:
        {
            "success": bool,
            "frame": int,
            "face_detected": bool,
            "status": str,
            "confidence": float,
            "liveness_score": float,
            "spoofing_risk": float,
            "challenge_instruction": str (optional),
            "head_pose": {"yaw": float, "pitch": float, "roll": float},
            "challenge_info": {} (optional)
        }
    """
    try:
        data = request.get_json()
        
        if not data or 'frame' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing frame data'
            }), 400
        
        # Get service
        service = get_liveness_service()
        
        # Process frame
        result = service.process_frame(session_id, data['frame'])
        
        status_code = 200 if result.get('success') else 400
        return jsonify(result), status_code
    
    except Exception as e:
        logger.error(f"Error processing frame: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@liveness_bp.route('/session/<session_id>/result', methods=['GET'])
def get_result(session_id):
    """
    Get final liveness detection result.
    
    Response:
        {
            "success": bool,
            "assessment": {
                "success": bool,
                "final_status": str,
                "average_confidence": float,
                "average_liveness_score": float,
                "average_spoofing_risk": float,
                "total_frames_processed": int,
                ...
            }
        }
    """
    try:
        service = get_liveness_service()
        result = service.get_session_result(session_id)
        
        status_code = 200 if result.get('success') else 400
        return jsonify(result), status_code
    
    except Exception as e:
        logger.error(f"Error getting result: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@liveness_bp.route('/session/<session_id>/close', methods=['POST'])
def close_session(session_id):
    """
    Close liveness detection session.
    
    Response:
        {
            "success": bool,
            "session_id": str,
            "frames_processed": int
        }
    """
    try:
        service = get_liveness_service()
        result = service.close_session(session_id)
        
        status_code = 200 if result.get('success') else 400
        return jsonify(result), status_code
    
    except Exception as e:
        logger.error(f"Error closing session: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@liveness_bp.route('/session/<session_id>/info', methods=['GET'])
def session_info(session_id):
    """
    Get current session information.
    
    Response:
        {
            "success": bool,
            "session_id": str,
            "status": str,
            "frames_processed": int,
            "duration_seconds": float,
            "challenge_instruction": str (optional)
        }
    """
    try:
        service = get_liveness_service()
        result = service.get_session_info(session_id)
        
        status_code = 200 if result.get('success') else 400
        return jsonify(result), status_code
    
    except Exception as e:
        logger.error(f"Error getting session info: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@liveness_bp.route('/health', methods=['GET'])
def health():
    """
    Check liveness detection service health.
    
    Response:
        {
            "status": "healthy",
            "active_sessions": int
        }
    """
    try:
        service = get_liveness_service()
        
        # Cleanup expired sessions
        service.cleanup_expired_sessions()
        
        return jsonify({
            'status': 'healthy',
            'active_sessions': service.get_active_sessions_count()
        }), 200
    
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500


@liveness_bp.route('/info', methods=['GET'])
def info():
    """
    Get liveness detection system information.
    
    Response:
        {
            "version": str,
            "capabilities": list,
            "algorithms": list
        }
    """
    return jsonify({
        'version': '1.0.0',
        'capabilities': [
            'face_detection',
            'head_pose_estimation',
            'liveness_detection',
            'anti_spoofing',
            'active_challenges',
            'micro_movement_analysis',
            'depth_analysis'
        ],
        'algorithms': [
            'Haar Cascades for face detection',
            'Geometric head pose estimation',
            'Temporal motion analysis',
            'Optical flow-based tracking',
            'Image processing for anti-spoofing',
            'Challenge-based liveness verification'
        ],
        'note': 'No AI models, no deep learning, no external APIs'
    }), 200
