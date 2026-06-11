#!/usr/bin/env python3
"""
Example API Integration Script
Demonstrates using the liveness detection API endpoints.
"""

import requests
import cv2
import base64
import json
import time
from datetime import datetime


class LivenessAPIClient:
    """
    Client for interacting with liveness detection API.
    """
    
    def __init__(self, base_url: str = 'http://localhost:5000'):
        """
        Initialize API client.
        
        Args:
            base_url: Base URL of the API
        """
        self.base_url = base_url
        self.session_id = None
        self.headers = {'Content-Type': 'application/json'}
    
    def create_session(self, enable_challenges: bool = True) -> dict:
        """Create new liveness detection session."""
        endpoint = f'{self.base_url}/api/liveness/session/create'
        
        payload = {
            'enable_challenges': enable_challenges
        }
        
        response = requests.post(endpoint, json=payload, headers=self.headers)
        result = response.json()
        
        if result.get('success'):
            self.session_id = result['session_id']
            print(f"✓ Session created: {self.session_id}")
            print(f"  Challenge instruction: {result.get('challenge_instruction', 'N/A')}")
        else:
            print(f"✗ Failed to create session: {result.get('error')}")
        
        return result
    
    def process_frame(self, frame: cv2.Mat) -> dict:
        """
        Process single video frame.
        
        Args:
            frame: Video frame (OpenCV format)
            
        Returns:
            Processing result
        """
        if not self.session_id:
            print("✗ No active session")
            return {}
        
        # Encode frame to base64
        _, buffer = cv2.imencode('.jpg', frame)
        frame_base64 = base64.b64encode(buffer).decode()
        
        endpoint = f'{self.base_url}/api/liveness/session/{self.session_id}/frame'
        
        payload = {
            'frame': frame_base64
        }
        
        response = requests.post(endpoint, json=payload, headers=self.headers)
        return response.json()
    
    def get_result(self) -> dict:
        """Get final liveness assessment."""
        if not self.session_id:
            print("✗ No active session")
            return {}
        
        endpoint = f'{self.base_url}/api/liveness/session/{self.session_id}/result'
        
        response = requests.get(endpoint, headers=self.headers)
        return response.json()
    
    def close_session(self) -> dict:
        """Close liveness detection session."""
        if not self.session_id:
            print("✗ No active session")
            return {}
        
        endpoint = f'{self.base_url}/api/liveness/session/{self.session_id}/close'
        
        response = requests.post(endpoint, headers=self.headers)
        return response.json()
    
    def get_session_info(self) -> dict:
        """Get current session information."""
        if not self.session_id:
            print("✗ No active session")
            return {}
        
        endpoint = f'{self.base_url}/api/liveness/session/{self.session_id}/info'
        
        response = requests.get(endpoint, headers=self.headers)
        return response.json()


def test_api_with_webcam():
    """
    Test API with webcam input.
    """
    print("=" * 60)
    print("Liveness Detection API Test - Webcam")
    print("=" * 60)
    
    # Initialize client
    client = LivenessAPIClient()
    
    # Create session
    print("\n1. Creating session...")
    session = client.create_session(enable_challenges=True)
    
    if not session.get('success'):
        print("✗ Failed to create session")
        return
    
    # Open webcam
    print("\n2. Opening webcam...")
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("✗ Failed to open webcam")
        return
    
    print("✓ Webcam opened")
    
    # Process frames
    print("\n3. Processing frames (10 seconds)...")
    frame_count = 0
    max_frames = 300  # 10 seconds at 30fps
    
    while frame_count < max_frames:
        ret, frame = cap.read()
        
        if not ret:
            break
        
        # Process frame via API
        result = client.process_frame(frame)
        
        if result.get('success'):
            status = result.get('status', 'UNKNOWN')
            liveness = result.get('liveness_score', 0)
            spoofing = result.get('spoofing_risk', 0)
            
            if frame_count % 30 == 0:  # Print every 1 second
                print(f"Frame {frame_count:3d}: Status={status:20s} | " +
                      f"Liveness={liveness:5.1f} | Spoofing={spoofing:.2f}")
            
            # Display frame
            if result.get('face_detected'):
                font = cv2.FONT_HERSHEY_SIMPLEX
                cv2.putText(frame, f"Status: {status}", (10, 30),
                           font, 0.7, (0, 255, 0), 2)
                cv2.putText(frame, f"Liveness: {liveness:.1f}", (10, 70),
                           font, 0.7, (0, 255, 0), 2)
                
                # Display challenge instruction if available
                challenge = result.get('challenge_instruction')
                if challenge:
                    cv2.putText(frame, f"Challenge: {challenge}", (10, 110),
                               font, 0.7, (255, 255, 0), 2)
            
            cv2.imshow('Liveness Detection', frame)
        
        frame_count += 1
        
        # Exit on 'q'
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    cv2.destroyAllWindows()
    
    # Get result
    print("\n4. Getting final result...")
    time.sleep(1)  # Wait for server to process
    
    result = client.get_result()
    
    if result.get('success'):
        assessment = result['assessment']
        
        print("\n" + "=" * 60)
        print("FINAL ASSESSMENT")
        print("=" * 60)
        print(f"Status: {assessment.get('final_status', 'UNKNOWN')}")
        print(f"Verified: {assessment.get('success', False)}")
        print(f"Confidence: {assessment.get('average_confidence', 0):.1%}")
        print(f"Liveness Score: {assessment.get('average_liveness_score', 0):.1f}")
        print(f"Spoofing Risk: {assessment.get('average_spoofing_risk', 0):.2f}")
        print(f"Frames Processed: {assessment.get('total_frames_processed', 0)}")
    
    # Close session
    print("\n5. Closing session...")
    client.close_session()
    print("✓ Session closed")


def test_api_health():
    """
    Test API health endpoint.
    """
    print("Testing API Health...")
    
    try:
        response = requests.get('http://localhost:5000/api/liveness/health')
        result = response.json()
        
        print(f"Status: {result.get('status', 'UNKNOWN')}")
        print(f"Active Sessions: {result.get('active_sessions', 0)}")
    
    except Exception as e:
        print(f"✗ Health check failed: {e}")


def test_api_info():
    """
    Test system info endpoint.
    """
    print("Getting System Information...")
    
    try:
        response = requests.get('http://localhost:5000/api/liveness/info')
        result = response.json()
        
        print(f"Version: {result.get('version', 'UNKNOWN')}")
        print(f"\nCapabilities:")
        for cap in result.get('capabilities', []):
            print(f"  - {cap}")
        print(f"\nAlgorithms:")
        for algo in result.get('algorithms', []):
            print(f"  - {algo}")
    
    except Exception as e:
        print(f"✗ Failed to get info: {e}")


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Test liveness detection API')
    parser.add_argument('--test', choices=['webcam', 'health', 'info'],
                       default='health', help='Test type')
    parser.add_argument('--url', default='http://localhost:5000',
                       help='API base URL')
    
    args = parser.parse_args()
    
    try:
        if args.test == 'webcam':
            test_api_with_webcam()
        elif args.test == 'health':
            test_api_health()
        elif args.test == 'info':
            test_api_info()
    
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
