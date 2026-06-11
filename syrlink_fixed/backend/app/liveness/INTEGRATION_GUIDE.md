# Advanced Liveness Detection - Integration Guide

## System Integration

### 1. Backend Integration (Flask)

#### Step 1: Update requirements.txt

Add the liveness detection dependencies to your `backend/requirements.txt`:

```
opencv-python>=4.5.0
numpy>=1.19.0
scipy>=1.5.0
```

Install dependencies:
```bash
pip install -r requirements.txt
```

#### Step 2: Initialize Liveness Module in Flask App

Update `backend/app/__init__.py`:

```python
from flask import Flask
from flask_sqlalchemy import SQLAlchemy

# ... existing imports and setup ...

def create_app(config_name='development'):
    app = Flask(__name__)
    
    # ... existing configuration ...
    
    # Register liveness detection blueprint
    from app.liveness.routes_flask import liveness_bp
    app.register_blueprint(liveness_bp)
    
    # Initialize liveness database models
    from app.liveness.models import create_liveness_tables
    with app.app_context():
        create_liveness_tables()
    
    return app
```

#### Step 3: Configure Liveness Settings

Create `backend/app/liveness/liveness_config.py` if needed for environment-specific config:

```python
import os
from .config import LivenessConfig

# Load from environment or use defaults
LivenessConfig.SESSION_TIMEOUT_SECONDS = int(os.getenv('LIVENESS_SESSION_TIMEOUT', '300'))
LivenessConfig.LIVENESS_SCORE_THRESHOLD = float(os.getenv('LIVENESS_SCORE_THRESHOLD', '70.0'))
LivenessConfig.ENABLE_CHALLENGES = os.getenv('LIVENESS_ENABLE_CHALLENGES', 'true').lower() == 'true'
```

#### Step 4: Test Backend Setup

```bash
# Test health endpoint
curl http://localhost:5000/api/liveness/health

# Test system info
curl http://localhost:5000/api/liveness/info
```

### 2. Frontend Integration (React/JavaScript)

#### Step 1: Include JavaScript Library

Add to your React component or HTML:

```javascript
import { LivenessDetectionClient } from './path/to/frontend_integration.js';
```

Or in HTML:
```html
<script src="/static/liveness_detection_client.js"></script>
```

#### Step 2: Create Liveness Verification Component

Example React component:

```jsx
import React, { useState, useRef } from 'react';
import { LivenessDetectionClient } from './liveness';

const LivenessVerification = ({ onVerificationComplete }) => {
    const [status, setStatus] = useState('idle');
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [challenge, setChallenge] = useState(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    
    const startVerification = async () => {
        try {
            setStatus('initializing');
            setError(null);
            
            // Create session
            const session = await LivenessDetectionClient.initializeSession({
                enableChallenges: true
            });
            
            setChallenge(session.challenge_instruction);
            
            // Start video capture
            setStatus('capturing');
            const result = await LivenessDetectionClient.startCapture(
                session.session_id,
                {
                    videoElementId: 'video',
                    canvasElementId: 'canvas',
                    fps: 30,
                    duration: 10,
                    onFrame: (frameData) => {
                        // Update UI with frame data
                        console.log('Frame:', frameData);
                    },
                    onError: (err) => {
                        setError(err.message);
                        setStatus('error');
                    }
                }
            );
            
            setResult(result);
            setStatus('completed');
            
            // Call callback
            onVerificationComplete(result);
            
        } catch (err) {
            setError(err.message);
            setStatus('error');
        }
    };
    
    return (
        <div className="liveness-verification">
            <h2>Face Liveness Verification</h2>
            
            <video
                ref={videoRef}
                id="video"
                style={{ display: 'none' }}
            />
            <canvas
                ref={canvasRef}
                id="canvas"
                style={{
                    maxWidth: '100%',
                    border: '1px solid #ccc',
                    margin: '10px 0'
                }}
            />
            
            {status === 'idle' && (
                <button onClick={startVerification} className="btn-primary">
                    Start Verification
                </button>
            )}
            
            {status === 'capturing' && (
                <div className="status-message">
                    <p>Challenge: {challenge}</p>
                    <p>Status: Capturing...</p>
                </div>
            )}
            
            {status === 'completed' && result && (
                <div className="result">
                    <h3>Verification Result</h3>
                    <p>Status: <strong>{result.final_status}</strong></p>
                    <p>Verified: {result.success ? 'YES ✓' : 'NO ✗'}</p>
                    <p>Confidence: {(result.average_confidence * 100).toFixed(1)}%</p>
                </div>
            )}
            
            {error && (
                <div className="error">
                    <p>Error: {error}</p>
                </div>
            )}
        </div>
    );
};

export default LivenessVerification;
```

#### Step 3: Add to Authentication Flow

Integrate into your existing registration/login:

```jsx
// In your registration or login component
import LivenessVerification from './LivenessVerification';

function RegisterPage() {
    const [userVerified, setUserVerified] = useState(false);
    
    const handleVerificationComplete = (result) => {
        if (result.success) {
            setUserVerified(true);
            // Continue with registration
            submitRegistration();
        }
    };
    
    return (
        <div>
            {!userVerified ? (
                <LivenessVerification onVerificationComplete={handleVerificationComplete} />
            ) : (
                <p>User verified! Continuing...</p>
            )}
        </div>
    );
}
```

### 3. Database Integration

#### Step 1: Initialize Database Tables

```bash
python -c "from app.liveness.models import create_liveness_tables; create_liveness_tables()"
```

Or in your Flask shell:
```python
from app.liveness.models import create_liveness_tables
create_liveness_tables()
```

#### Step 2: Store Verification Results

```python
from app.liveness.models import LivenessSession, LivenessVerification
from uuid import uuid4

# Store session result
session = LivenessSession(
    id=session_id,
    user_id=user_id,
    session_type='registration',
    final_status='LIVENESS_CONFIRMED',
    confidence=0.85,
    liveness_score=78.5,
    spoofing_risk=0.12,
    is_live=True
)
db.session.add(session)

# Store verification record
verification = LivenessVerification(
    id=str(uuid4()),
    user_id=user_id,
    session_id=session_id,
    verification_type='registration',
    is_verified=True,
    verification_status='LIVENESS_CONFIRMED',
    verification_confidence=0.85
)
db.session.add(verification)

db.session.commit()
```

#### Step 3: Query Verification History

```python
from app.liveness.models import LivenessVerification, get_session_statistics

# Get verification history for user
verifications = LivenessVerification.query.filter_by(
    user_id=user_id
).order_by(
    LivenessVerification.verified_at.desc()
).limit(10).all()

# Get statistics
stats = get_session_statistics(user_id, days=30)
print(f"Success rate: {stats['success_rate']:.1f}%")
```

### 4. API Integration with Authentication

#### Add Liveness Check to Login

```python
from flask import request, jsonify
from app.liveness.api_service import get_liveness_service

@app.route('/api/auth/verify-liveness', methods=['POST'])
def verify_liveness():
    """Verify liveness before completing login."""
    data = request.json
    session_id = data.get('session_id')
    
    service = get_liveness_service()
    result = service.get_session_result(session_id)
    
    if not result.get('success'):
        return jsonify({'error': 'Liveness verification failed'}), 401
    
    assessment = result['assessment']
    
    if not assessment.get('success'):
        return jsonify({
            'error': 'User could not be verified as live',
            'reason': assessment.get('final_status')
        }), 401
    
    # Continue with login process
    # ... issue token, set session, etc.
    
    return jsonify({'authenticated': True}), 200
```

### 5. Monitoring and Logging

#### Enable Logging

```python
import logging
from app.liveness.config import LivenessConfig

logging.basicConfig(
    level=logging.INFO,
    filename=LivenessConfig.LOG_FILE,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)
```

#### Monitor Active Sessions

```python
# Periodic task to check system health
from app.liveness.api_service import get_liveness_service

def monitor_liveness_health():
    service = get_liveness_service()
    
    # Cleanup expired sessions
    expired = service.cleanup_expired_sessions()
    
    active = service.get_active_sessions_count()
    
    logger.info(f"Liveness system - Active sessions: {active}, Expired: {expired}")
```

### 6. Performance Optimization

#### For High-Traffic Systems

```python
# Use process pooling
from multiprocessing import Pool
from app.liveness import VideoLivenessProcessor

class LivenessProcessorPool:
    def __init__(self, num_workers=4):
        self.pool = Pool(processes=num_workers)
        self.processors = [VideoLivenessProcessor() for _ in range(num_workers)]
    
    def process_frame(self, frame, processor_id=0):
        return self.processors[processor_id % len(self.processors)].process_frame(frame)
```

#### For Mobile Devices

```python
# Reduce processing overhead for mobile
processor = VideoLivenessProcessor(
    target_fps=20,               # Lower FPS
    analysis_duration_sec=3      # Shorter analysis
)

# Use lower resolution
config.MAX_FRAME_SIZE = (640, 480)
```

### 7. Security Considerations

#### API Security

```python
# Add rate limiting
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

@app.route('/api/liveness/session/create', methods=['POST'])
@limiter.limit("5 per minute")
def create_session():
    # ... endpoint code ...
```

#### Secure Data Storage

```python
# Encrypt sensitive data before storing
from cryptography.fernet import Fernet

cipher = Fernet(encryption_key)

# Store encrypted verification data
encrypted_data = cipher.encrypt(json.dumps(result).encode())
verification.metadata = encrypted_data.decode()
```

## Troubleshooting Integration

### Issue: Import Errors

**Solution**: Ensure liveness package is in Python path:
```python
import sys
sys.path.insert(0, '/path/to/backend')
```

### Issue: Database Migration Issues

**Solution**: Manually create tables:
```python
from app import db
from app.liveness.models import LivenessSession, LivenessFrame, LivenessVerification

db.create_all()
```

### Issue: API Endpoints Not Available

**Solution**: Verify blueprint is registered:
```python
# Check registered blueprints
print(app.blueprints)
```

### Issue: OpenCV/Face Detection Not Working

**Solution**: Verify cascade file path:
```python
import cv2
cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
cascade = cv2.CascadeClassifier(cascade_path)
if cascade.empty():
    print("Cascade file not found!")
```

## Testing Integration

Run integration tests:

```bash
# Test backend processing
python app/liveness/test_liveness.py --mode webcam

# Test API
python app/liveness/test_api.py --test webcam

# Test with video file
python app/liveness/test_liveness.py --mode video --input test_video.mp4
```

## Deployment

### Docker Integration

```dockerfile
FROM python:3.9

# Install dependencies
RUN apt-get update && apt-get install -y \
    libsm6 libxext6 libxrender-dev

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["python", "-m", "flask", "run"]
```

### Production Checklist

- [ ] OpenCV properly installed
- [ ] Database migrations completed
- [ ] API endpoints tested
- [ ] Frontend components integrated
- [ ] Logging configured
- [ ] Monitoring set up
- [ ] Rate limiting enabled
- [ ] Security headers added
- [ ] SSL/TLS configured
- [ ] Performance tuning done

---

**Status**: Ready for production deployment  
**Last Updated**: 2024  
**Support**: See LIVENESS_DETECTION_GUIDE.md for technical details
