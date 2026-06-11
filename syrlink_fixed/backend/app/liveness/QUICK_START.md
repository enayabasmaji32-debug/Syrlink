# Advanced Liveness Detection - Quick Start Guide

## 5-Minute Setup

### 1. Backend Integration

#### Step 1: Add to Flask Application

```python
# In your main Flask app (app.py or __init__.py)
from flask import Flask
from app.liveness.routes_flask import liveness_bp

app = Flask(__name__)

# Register liveness detection routes
app.register_blueprint(liveness_bp)
```

#### Step 2: Ensure OpenCV is Installed

```bash
pip install opencv-python numpy
```

#### Step 3: Test Backend

```bash
curl http://localhost:5000/api/liveness/info
```

Expected response:
```json
{
    "version": "1.0.0",
    "capabilities": [
        "face_detection",
        "head_pose_estimation",
        "liveness_detection",
        ...
    ],
    "note": "No AI models, no deep learning, no external APIs"
}
```

### 2. Frontend Integration

#### Step 1: Add JavaScript Library

Include in your HTML:
```html
<script src="/path/to/frontend_integration.js"></script>
```

#### Step 2: Create HTML

```html
<div id="liveness-container">
    <video id="video" style="display:none;"></video>
    <canvas id="canvas" style="border: 1px solid #ccc; width: 100%;"></canvas>
    
    <button onclick="startLiveness()">Start Liveness Detection</button>
    <div id="status"></div>
    <div id="result"></div>
</div>

<script>
async function startLiveness() {
    try {
        // Initialize session
        const session = await LivenessDetectionClient.initializeSession();
        console.log('Session created:', session.sessionId);
        
        // Start capture
        const result = await LivenessDetectionClient.startCapture(
            session.sessionId,
            {
                fps: 30,
                duration: 10,
                onFrame: (data) => {
                    document.getElementById('status').innerHTML = `
                        Liveness: ${data.livenessScore?.toFixed(1) || 'N/A'}
                        | Spoofing Risk: ${(data.spoofingRisk * 100).toFixed(1)}%
                        | Status: ${data.status}
                    `;
                },
                onError: (err) => {
                    console.error('Error:', err);
                }
            }
        );
        
        // Show result
        document.getElementById('result').innerHTML = `
            <h3>Result: ${result.final_status}</h3>
            <p>Confirmed: ${result.success ? 'YES ✓' : 'NO'}</p>
            <p>Confidence: ${(result.average_confidence * 100).toFixed(1)}%</p>
        `;
        
    } catch (error) {
        console.error('Failed:', error);
    }
}
</script>
```

### 3. Using from Python

#### Basic Usage

```python
from app.liveness.video_processor import VideoLivenessProcessor

# Create processor
processor = VideoLivenessProcessor(
    enable_challenges=True,
    target_fps=30
)

# Process video
result = processor.process_video_stream(
    video_source=0,  # Webcam
    output_video='liveness_output.mp4',
    max_frames=300  # 10 seconds at 30fps
)

print(f"Liveness Status: {result['final_status']}")
print(f"Confidence: {result['average_confidence']:.1%}")
print(f"Verified: {result['success']}")
```

#### Frame-by-Frame Processing

```python
import cv2
from app.liveness import VideoLivenessProcessor

processor = VideoLivenessProcessor()
cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret:
        break
    
    result = processor.process_frame(frame)
    
    # Access results
    if result.get('face_detected'):
        print(f"Liveness Score: {result['liveness']['liveness_score']}")
        print(f"Spoofing Risk: {result['anti_spoofing']['spoofing_risk']:.2f}")
        print(f"Head Pose: Y={result['head_pose']['yaw']:.1f}° P={result['head_pose']['pitch']:.1f}°")
    
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
```

## API Endpoints

### 1. Create Session
```bash
POST /api/liveness/session/create
Content-Type: application/json

{
    "enable_challenges": true
}

Response: {
    "success": true,
    "session_id": "uuid...",
    "challenge_instruction": "Turn your head to the right"
}
```

### 2. Process Frame
```bash
POST /api/liveness/session/{SESSION_ID}/frame
Content-Type: application/json

{
    "frame": "base64_encoded_jpeg_image"
}

Response: {
    "success": true,
    "frame": 45,
    "face_detected": true,
    "status": "ANALYZING",
    "confidence": 0.75,
    "liveness_score": 78.5,
    "spoofing_risk": 0.12,
    "head_pose": {...},
    "challenge_info": {...}
}
```

### 3. Get Result
```bash
GET /api/liveness/session/{SESSION_ID}/result

Response: {
    "success": true,
    "assessment": {
        "final_status": "LIVENESS_CONFIRMED",
        "average_confidence": 0.82,
        "total_frames_processed": 300
    }
}
```

### 4. Close Session
```bash
POST /api/liveness/session/{SESSION_ID}/close

Response: {
    "success": true,
    "frames_processed": 300
}
```

## Detection Flow

```
1. User clicks "Start Liveness Detection"
    ↓
2. Browser requests camera access
    ↓
3. Session created on server (/api/liveness/session/create)
    ↓
4. Frames captured at 30 FPS
    ↓
5. Each frame sent to /api/liveness/session/{id}/frame
    ↓
6. Backend processes:
    - Face detection
    - Head pose estimation
    - Liveness analysis
    - Anti-spoofing check
    - Challenge verification
    ↓
7. Real-time feedback shown to user
    ↓
8. After 10 seconds (or when all challenges complete):
    ↓
9. Get final result from /api/liveness/session/{id}/result
    ↓
10. Display verification result to user
```

## Testing

### Quick Test Script

```python
import cv2
import base64
import requests
import json

# Initialize session
response = requests.post('http://localhost:5000/api/liveness/session/create')
session_id = response.json()['session_id']
print(f"Session ID: {session_id}")

# Open webcam
cap = cv2.VideoCapture(0)

frame_count = 0
while frame_count < 60:  # 2 seconds at 30fps
    ret, frame = cap.read()
    if not ret:
        break
    
    # Encode frame
    _, buffer = cv2.imencode('.jpg', frame)
    frame_base64 = base64.b64encode(buffer).decode()
    
    # Send frame
    response = requests.post(
        f'http://localhost:5000/api/liveness/session/{session_id}/frame',
        json={'frame': frame_base64}
    )
    
    result = response.json()
    print(f"Frame {frame_count}: Status={result.get('status')}, " +
          f"Liveness={result.get('liveness_score'):.1f}, " +
          f"Spoofing Risk={result.get('spoofing_risk'):.2f}")
    
    frame_count += 1

cap.release()

# Get final result
response = requests.get(
    f'http://localhost:5000/api/liveness/session/{session_id}/result'
)
result = response.json()
print("\nFinal Result:")
print(json.dumps(result['assessment'], indent=2))
```

## Common Issues & Solutions

### Issue: No Face Detected
**Solution**: 
- Ensure good lighting
- Position face properly in frame
- Move closer to camera
- Check camera is working

### Issue: Low Liveness Score
**Solution**:
- Make natural head movements
- Blink during capture
- Ensure face fills ~50% of frame
- Improve lighting

### Issue: High Spoofing Risk
**Solution**:
- Move to different lighting
- Remove glasses/sunglasses
- Move away from reflective surfaces
- Use camera instead of phone

### Issue: Challenges Not Completing
**Solution**:
- Turn head more deliberately (>30°)
- Open mouth more distinctly
- Blink naturally
- Stay within frame

## Performance Tips

### For Better Results
1. **Lighting**: Face well-lit from front
2. **Distance**: Face fills 30-50% of frame
3. **Stability**: Keep camera steady
4. **Movement**: Make natural movements
5. **Time**: Allow 8-15 seconds per verification

### For Faster Processing
1. Reduce FPS if on mobile (20 FPS)
2. Use lower resolution frames if bandwidth limited
3. Reduce analysis duration
4. Disable challenges if not needed

## Next Steps

1. **Integrate with your authentication system**:
   - Call `/api/liveness/session/create` during registration
   - Process frames from webcam
   - Get result and verify user

2. **Add to your database**:
   - Store liveness verification results
   - Link to user verification records
   - Create audit trail

3. **Frontend customization**:
   - Add progress bar
   - Display challenge instructions
   - Customize styling

4. **Advanced features**:
   - Multi-challenge verification
   - Higher security modes
   - Accessibility options

## Support

For issues or questions:
1. Check LIVENESS_DETECTION_GUIDE.md for technical details
2. Review test scripts for usage examples
3. Check logs for error messages

---

**Ready to use!** Start with the basic example above and extend from there.
