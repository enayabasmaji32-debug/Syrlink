"""
Liveness Detection Frontend Integration
JavaScript/React integration for frontend video capture and submission
"""

const LivenessDetectionClient = {
    /**
     * Initialize liveness detection session
     * @param {Object} options - Configuration options
     * @returns {Promise<Object>} Session initialization data
     */
    async initializeSession(options = {}) {
        try {
            const response = await fetch('/api/liveness/session/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    enable_challenges: options.enableChallenges !== false,
                    ...options
                })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to create session');
            }
            
            return {
                sessionId: data.session_id,
                challengeInstruction: data.challenge_instruction,
                ...data
            };
        } catch (error) {
            console.error('Session initialization failed:', error);
            throw error;
        }
    },
    
    /**
     * Start video capture and liveness detection
     * @param {string} sessionId - Session ID from initialization
     * @param {Object} options - Capture options
     * @returns {Promise<Object>} Detection results
     */
    async startCapture(sessionId, options = {}) {
        const {
            videoElementId = 'video',
            canvasElementId = 'canvas',
            fps = 30,
            duration = 10,
            onFrame = null,
            onResult = null,
            onError = null
        } = options;
        
        try {
            const video = document.getElementById(videoElementId);
            const canvas = document.getElementById(canvasElementId);
            
            if (!video || !canvas) {
                throw new Error('Video or canvas element not found');
            }
            
            const ctx = canvas.getContext('2d');
            const frameInterval = 1000 / fps;
            const maxFrames = Math.floor(duration * fps);
            let frameCount = 0;
            let isProcessing = false;
            
            // Request camera access
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: false
            });
            
            video.srcObject = stream;
            
            // Wait for video to load
            await new Promise(resolve => {
                video.onloadedmetadata = resolve;
            });
            
            video.play();
            
            // Set canvas dimensions
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // Capture and process frames
            return new Promise((resolve, reject) => {
                const captureInterval = setInterval(async () => {
                    if (frameCount >= maxFrames) {
                        clearInterval(captureInterval);
                        stream.getTracks().forEach(track => track.stop());
                        
                        // Get final result
                        try {
                            const result = await LivenessDetectionClient.getResult(sessionId);
                            if (onResult) {
                                onResult(result.assessment);
                            }
                            resolve(result.assessment);
                        } catch (error) {
                            reject(error);
                        }
                        return;
                    }
                    
                    if (!isProcessing) {
                        isProcessing = true;
                        
                        try {
                            // Capture frame
                            ctx.drawImage(video, 0, 0);
                            const frameData = canvas.toDataURL('image/jpeg', 0.8);
                            
                            // Convert to base64 without data URL prefix
                            const base64Frame = frameData.split(',')[1];
                            
                            // Process frame
                            const result = await LivenessDetectionClient.processFrame(
                                sessionId,
                                base64Frame
                            );
                            
                            if (onFrame) {
                                onFrame(result);
                            }
                            
                            frameCount++;
                        } catch (error) {
                            console.error('Frame processing error:', error);
                            if (onError) {
                                onError(error);
                            }
                        } finally {
                            isProcessing = false;
                        }
                    }
                }, frameInterval);
            });
        } catch (error) {
            console.error('Capture failed:', error);
            throw error;
        }
    },
    
    /**
     * Process single frame
     * @param {string} sessionId - Session ID
     * @param {string} frameBase64 - Base64-encoded frame
     * @returns {Promise<Object>} Frame processing result
     */
    async processFrame(sessionId, frameBase64) {
        try {
            const response = await fetch(`/api/liveness/session/${sessionId}/frame`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    frame: frameBase64
                })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Frame processing failed');
            }
            
            return {
                frame: data.frame,
                faceDetected: data.face_detected,
                status: data.status,
                confidence: data.confidence,
                livenessScore: data.liveness_score,
                spoofingRisk: data.spoofing_risk,
                challengeInstruction: data.challenge_instruction,
                headPose: data.head_pose,
                challengeInfo: data.challenge_info,
                processingTimeMs: data.processing_time_ms
            };
        } catch (error) {
            console.error('Frame processing failed:', error);
            throw error;
        }
    },
    
    /**
     * Get session result
     * @param {string} sessionId - Session ID
     * @returns {Promise<Object>} Final assessment
     */
    async getResult(sessionId) {
        try {
            const response = await fetch(`/api/liveness/session/${sessionId}/result`);
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to get result');
            }
            
            return data.assessment;
        } catch (error) {
            console.error('Result retrieval failed:', error);
            throw error;
        }
    },
    
    /**
     * Get session info
     * @param {string} sessionId - Session ID
     * @returns {Promise<Object>} Session information
     */
    async getSessionInfo(sessionId) {
        try {
            const response = await fetch(`/api/liveness/session/${sessionId}/info`);
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to get session info');
            }
            
            return data;
        } catch (error) {
            console.error('Session info retrieval failed:', error);
            throw error;
        }
    },
    
    /**
     * Close session
     * @param {string} sessionId - Session ID
     * @returns {Promise<Object>} Close result
     */
    async closeSession(sessionId) {
        try {
            const response = await fetch(`/api/liveness/session/${sessionId}/close`, {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to close session');
            }
            
            return data;
        } catch (error) {
            console.error('Session closing failed:', error);
            throw error;
        }
    },
    
    /**
     * Check service health
     * @returns {Promise<Object>} Health status
     */
    async checkHealth() {
        try {
            const response = await fetch('/api/liveness/health');
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Health check failed:', error);
            return { status: 'unhealthy', error: error.message };
        }
    },
    
    /**
     * Get system info
     * @returns {Promise<Object>} System information
     */
    async getSystemInfo() {
        try {
            const response = await fetch('/api/liveness/info');
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Failed to get system info:', error);
            throw error;
        }
    }
};


// React Component Example
const LivenessDetectionComponent = () => {
    const [sessionId, setSessionId] = React.useState(null);
    const [status, setStatus] = React.useState('idle');
    const [result, setResult] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [frameInfo, setFrameInfo] = React.useState(null);
    const videoRef = React.useRef(null);
    const canvasRef = React.useRef(null);
    
    const startLivenessDetection = async () => {
        try {
            setStatus('initializing');
            setError(null);
            
            // Initialize session
            const session = await LivenessDetectionClient.initializeSession({
                enableChallenges: true
            });
            
            setSessionId(session.sessionId);
            
            // Start capture
            setStatus('capturing');
            const detectionResult = await LivenessDetectionClient.startCapture(
                session.sessionId,
                {
                    videoElementId: 'video',
                    canvasElementId: 'canvas',
                    fps: 30,
                    duration: 10,
                    onFrame: (frameData) => {
                        setFrameInfo({
                            frame: frameData.frame,
                            status: frameData.status,
                            confidence: (frameData.confidence * 100).toFixed(1),
                            livenessScore: frameData.livenessScore?.toFixed(1),
                            spoofingRisk: (frameData.spoofingRisk * 100).toFixed(1),
                            faceDetected: frameData.faceDetected
                        });
                    },
                    onError: (err) => {
                        setError(err.message);
                    }
                }
            );
            
            setResult(detectionResult);
            setStatus('completed');
            
        } catch (err) {
            setError(err.message);
            setStatus('error');
        }
    };
    
    const resetDetection = async () => {
        if (sessionId) {
            await LivenessDetectionClient.closeSession(sessionId);
        }
        setSessionId(null);
        setStatus('idle');
        setResult(null);
        setError(null);
        setFrameInfo(null);
    };
    
    return (
        <div className="liveness-detection-container">
            <h2>Advanced Liveness Detection</h2>
            
            <div className="video-section">
                <video
                    ref={videoRef}
                    id="video"
                    className="video-element"
                    style={{ display: 'none' }}
                />
                <canvas
                    ref={canvasRef}
                    id="canvas"
                    className="canvas-element"
                    style={{ maxWidth: '100%', border: '1px solid #ccc' }}
                />
            </div>
            
            <div className="info-section">
                <h3>Status: {status}</h3>
                
                {frameInfo && (
                    <div className="frame-info">
                        <p>Frame: {frameInfo.frame}</p>
                        <p>Face Detected: {frameInfo.faceDetected ? 'Yes' : 'No'}</p>
                        <p>Status: {frameInfo.status}</p>
                        <p>Confidence: {frameInfo.confidence}%</p>
                        <p>Liveness Score: {frameInfo.livenessScore}</p>
                        <p>Spoofing Risk: {frameInfo.spoofingRisk}%</p>
                    </div>
                )}
                
                {result && (
                    <div className="result-section">
                        <h3>Final Result:</h3>
                        <p>Status: <strong>{result.final_status}</strong></p>
                        <p>Liveness Confirmed: {result.success ? 'YES ✓' : 'NO ✗'}</p>
                        <p>Average Confidence: {(result.average_confidence * 100).toFixed(1)}%</p>
                        <p>Frames Processed: {result.total_frames_processed}</p>
                    </div>
                )}
                
                {error && (
                    <div className="error-section" style={{ color: 'red' }}>
                        <p>Error: {error}</p>
                    </div>
                )}
            </div>
            
            <div className="controls">
                <button
                    onClick={startLivenessDetection}
                    disabled={status !== 'idle'}
                    className="btn-start"
                >
                    Start Liveness Detection
                </button>
                
                <button
                    onClick={resetDetection}
                    disabled={status === 'idle'}
                    className="btn-reset"
                >
                    Reset
                </button>
            </div>
            
            <style>{`
                .liveness-detection-container {
                    padding: 20px;
                    max-width: 800px;
                    margin: 0 auto;
                }
                
                .video-section {
                    margin: 20px 0;
                }
                
                .canvas-element {
                    width: 100%;
                    background: #000;
                }
                
                .info-section {
                    padding: 15px;
                    background: #f5f5f5;
                    border-radius: 8px;
                    margin: 20px 0;
                }
                
                .frame-info, .result-section {
                    margin: 10px 0;
                    padding: 10px;
                    background: white;
                    border-radius: 4px;
                    border-left: 4px solid #2196F3;
                }
                
                .error-section {
                    padding: 10px;
                    background: #ffebee;
                    border-radius: 4px;
                    border-left: 4px solid #f44336;
                }
                
                .controls {
                    display: flex;
                    gap: 10px;
                    margin: 20px 0;
                }
                
                button {
                    padding: 10px 20px;
                    font-size: 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .btn-start {
                    background: #4CAF50;
                    color: white;
                }
                
                .btn-start:hover:not(:disabled) {
                    background: #45a049;
                }
                
                .btn-reset {
                    background: #f44336;
                    color: white;
                }
                
                .btn-reset:hover:not(:disabled) {
                    background: #da190b;
                }
                
                button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
};
