#!/usr/bin/env python3
"""
Example Test Script: Liveness Detection from Webcam
Demonstrates real-time liveness detection using the complete system.
"""

import sys
import cv2
import time
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, '/path/to/backend')

from app.liveness import VideoLivenessProcessor


def test_webcam_liveness():
    """
    Test liveness detection using webcam.
    """
    print("=" * 60)
    print("Advanced Liveness Detection - Webcam Test")
    print("=" * 60)
    print("\nInitializing system...")
    
    # Create processor
    processor = VideoLivenessProcessor(
        enable_challenges=True,
        target_fps=30,
        analysis_duration_sec=5
    )
    
    print("✓ Liveness detection system initialized")
    print(f"  - Face Detection: Haar Cascades")
    print(f"  - Head Pose Estimation: Geometric algorithms")
    print(f"  - Anti-Spoofing: Image processing")
    print(f"  - Active Challenges: Enabled")
    print(f"  - Target FPS: 30")
    print("\nStarting webcam...")
    
    # Open webcam
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("✗ Failed to open webcam")
        return
    
    print("✓ Webcam opened")
    print("\nInstructions:")
    print("  1. Position your face in the frame")
    print("  2. Follow the on-screen challenge instructions")
    print("  3. Press 'q' to stop at any time")
    print("\nStarting analysis...\n")
    
    frame_count = 0
    start_time = time.time()
    max_frames = 300  # 10 seconds at 30fps
    
    while frame_count < max_frames:
        ret, frame = cap.read()
        
        if not ret:
            print("✗ Failed to read frame")
            break
        
        # Process frame
        result = processor.process_frame(frame)
        frame_count += 1
        
        # Draw visualizations
        if result.get('face_detected'):
            frame = processor._draw_visualizations(frame, result)
        
        # Display frame
        cv2.imshow('Liveness Detection', frame)
        
        # Print status every 30 frames
        if frame_count % 30 == 0:
            elapsed = time.time() - start_time
            fps = frame_count / elapsed
            liveness = result.get('liveness', {}).get('liveness_score', 0)
            spoofing = result.get('anti_spoofing', {}).get('spoofing_risk', 0)
            status = result.get('status', 'UNKNOWN')
            
            print(f"Frame {frame_count:3d} | FPS: {fps:.1f} | Status: {status:20s} | " +
                  f"Liveness: {liveness:5.1f} | Spoofing Risk: {spoofing:.2f}")
        
        # Check for 'q' key
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("\n✗ Detection stopped by user")
            break
    
    cap.release()
    cv2.destroyAllWindows()
    
    # Generate final assessment
    print("\n" + "=" * 60)
    print("FINAL LIVENESS ASSESSMENT")
    print("=" * 60)
    
    assessment = processor._generate_final_assessment()
    
    print(f"\nFinal Status: {assessment.get('final_status', 'UNKNOWN')}")
    print(f"Verification Success: {'YES ✓' if assessment.get('success') else 'NO ✗'}")
    print(f"\nStatistics:")
    print(f"  - Total Frames Processed: {assessment.get('total_frames_processed', 0)}")
    print(f"  - Average Confidence: {assessment.get('average_confidence', 0):.1%}")
    print(f"  - Average Liveness Score: {assessment.get('average_liveness_score', 0):.1f}")
    print(f"  - Average Spoofing Risk: {assessment.get('average_spoofing_risk', 0):.2f}")
    print(f"  - Max Liveness Score: {assessment.get('max_liveness_score', 0):.1f}")
    
    status_dist = assessment.get('status_distribution', {})
    if status_dist:
        print(f"\nStatus Distribution:")
        for status, count in status_dist.items():
            percentage = (count / assessment.get('total_frames_processed', 1)) * 100
            print(f"  - {status}: {count} frames ({percentage:.1f}%)")
    
    print("\n" + "=" * 60)


def test_video_file_liveness(video_path: str, output_path: str = None):
    """
    Test liveness detection using video file.
    
    Args:
        video_path: Path to input video file
        output_path: Optional path to save output video
    """
    print("=" * 60)
    print(f"Liveness Detection - Video File Test")
    print(f"Input: {video_path}")
    print("=" * 60)
    
    # Create processor
    processor = VideoLivenessProcessor(enable_challenges=True)
    
    print("\nProcessing video...")
    
    # Process video
    result = processor.process_video_stream(
        video_source=video_path,
        output_video=output_path,
        max_frames=300  # Limit for testing
    )
    
    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)
    print(f"Final Status: {result.get('final_status', 'UNKNOWN')}")
    print(f"Success: {result.get('success', False)}")
    print(f"Average Confidence: {result.get('average_confidence', 0):.1%}")


def test_frame_by_frame(video_path: str, max_frames: int = 100):
    """
    Test frame-by-frame processing with detailed output.
    """
    print("=" * 60)
    print("Frame-by-Frame Liveness Detection Test")
    print("=" * 60)
    
    processor = VideoLivenessProcessor(enable_challenges=True)
    cap = cv2.VideoCapture(video_path)
    
    frame_count = 0
    
    print(f"\n{'Frame':<6} {'Status':<20} {'Liveness':<10} {'Spoofing':<10} {'Challenge':<20}")
    print("-" * 66)
    
    while True:
        ret, frame = cap.read()
        
        if not ret or frame_count >= max_frames:
            break
        
        result = processor.process_frame(frame)
        
        frame_num = result.get('frame', 0)
        status = result.get('status', 'UNKNOWN')[:19]
        liveness = result.get('liveness', {}).get('liveness_score', 0)
        spoofing = result.get('anti_spoofing', {}).get('spoofing_risk', 0)
        challenge = result.get('challenges', {}).get('current_challenge', 'N/A')
        if challenge:
            challenge = challenge[:19]
        
        print(f"{frame_num:<6} {status:<20} {liveness:<10.1f} {spoofing:<10.2f} {challenge:<20}")
        
        frame_count += 1
    
    cap.release()
    
    print("-" * 66)
    print(f"\nTotal Frames Processed: {frame_count}")


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Test liveness detection system')
    parser.add_argument('--mode', choices=['webcam', 'video', 'frame-by-frame'],
                       default='webcam', help='Test mode')
    parser.add_argument('--input', help='Input video file path (for video mode)')
    parser.add_argument('--output', help='Output video path (optional)')
    parser.add_argument('--max-frames', type=int, default=300, help='Maximum frames to process')
    
    args = parser.parse_args()
    
    try:
        if args.mode == 'webcam':
            test_webcam_liveness()
        
        elif args.mode == 'video':
            if not args.input:
                print("Error: --input required for video mode")
                sys.exit(1)
            test_video_file_liveness(args.input, args.output)
        
        elif args.mode == 'frame-by-frame':
            if not args.input:
                print("Error: --input required for frame-by-frame mode")
                sys.exit(1)
            test_frame_by_frame(args.input, args.max_frames)
    
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
