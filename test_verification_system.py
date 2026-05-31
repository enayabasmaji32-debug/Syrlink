#!/usr/bin/env python3
"""
Quick Test Script for Professional Verification System
Tests the 4-stage verification workflow
"""

import requests
import json
from pprint import pprint

BASE_URL = "http://localhost:8000/api"

# Test Credentials (Admin)
ADMIN_TOKEN = None  # Set after login

# Test Data
USER_EMAIL = "test@example.com"
USER_PASSWORD = "Test1234!"

def test_submit_verification():
    """Test submitting a verification request"""
    print("\n" + "="*60)
    print("TEST 1: Submit Verification Request")
    print("="*60)
    
    payload = {
        "document_url": "https://example.com/id.pdf",
        "document_type": "id",
        "note": "My national ID card"
    }
    
    response = requests.post(
        f"{BASE_URL}/verification/request",
        json=payload,
        headers={"Authorization": f"Bearer {USER_TOKEN}"}
    )
    
    print(f"Status: {response.status_code}")
    result = response.json()
    pprint(result)
    
    request_id = result.get("id")
    print(f"\n✓ Request ID: {request_id}")
    return request_id

def test_get_verification_status(request_id):
    """Test getting verification status"""
    print("\n" + "="*60)
    print("TEST 2: Get Verification Status")
    print("="*60)
    
    response = requests.get(
        f"{BASE_URL}/verification/me",
        headers={"Authorization": f"Bearer {USER_TOKEN}"}
    )
    
    print(f"Status: {response.status_code}")
    result = response.json()
    pprint(result)
    
    current_stage = result.get("current_stage")
    print(f"\n✓ Current Stage: {current_stage}")

def test_admin_view_pending():
    """Test admin viewing pending verifications"""
    print("\n" + "="*60)
    print("TEST 3: Admin View Pending Verifications")
    print("="*60)
    
    response = requests.get(
        f"{BASE_URL}/admin/verification-requests?status=pending",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"}
    )
    
    print(f"Status: {response.status_code}")
    result = response.json()
    pprint(result[:1] if result else [])  # Show first one
    
    print(f"\n✓ Total Pending: {len(result)}")

def test_admin_update_stage(request_id):
    """Test admin updating verification stage"""
    print("\n" + "="*60)
    print("TEST 4: Admin Update Verification Stage")
    print("="*60)
    
    stages = ["identity_check", "face_match", "under_review", "final_decision"]
    
    for stage in stages:
        print(f"\nMoving to: {stage.upper()}")
        response = requests.post(
            f"{BASE_URL}/admin/verification-requests/{request_id}/stage",
            params={"new_stage": stage},
            headers={"Authorization": f"Bearer {ADMIN_TOKEN}"}
        )
        print(f"Status: {response.status_code}")
        pprint(response.json())

def test_admin_reject(request_id):
    """Test admin rejecting verification"""
    print("\n" + "="*60)
    print("TEST 5: Admin Reject Verification")
    print("="*60)
    
    response = requests.post(
        f"{BASE_URL}/admin/verification-requests/{request_id}/reject",
        params={"reason": "Document image is too blurry"},
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"}
    )
    
    print(f"Status: {response.status_code}")
    pprint(response.json())

def test_admin_approve(request_id):
    """Test admin approving verification"""
    print("\n" + "="*60)
    print("TEST 6: Admin Approve Verification")
    print("="*60)
    
    response = requests.post(
        f"{BASE_URL}/admin/verification-requests/{request_id}/approve",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"}
    )
    
    print(f"Status: {response.status_code}")
    pprint(response.json())

if __name__ == "__main__":
    print("\n" + "="*60)
    print("PROFESSIONAL VERIFICATION SYSTEM - TEST SUITE")
    print("="*60)
    
    # Login as user
    print("\nLogging in as user...")
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": USER_EMAIL, "password": USER_PASSWORD}
    )
    if response.status_code == 200:
        USER_TOKEN = response.json().get("access_token")
        print(f"✓ User logged in: {USER_TOKEN[:20]}...")
    else:
        print(f"✗ User login failed: {response.text}")
        exit(1)
    
    # Login as admin
    print("\nLogging in as admin...")
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": "admin@example.com", "password": "Admin1234!"}
    )
    if response.status_code == 200:
        ADMIN_TOKEN = response.json().get("access_token")
        print(f"✓ Admin logged in: {ADMIN_TOKEN[:20]}...")
    else:
        print(f"✗ Admin login failed: {response.text}")
        exit(1)
    
    # Run tests
    request_id = test_submit_verification()
    test_get_verification_status(request_id)
    test_admin_view_pending()
    test_admin_update_stage(request_id)
    
    # Create new request for rejection test
    print("\n" + "="*60)
    print("CREATING NEW REQUEST FOR REJECTION TEST")
    print("="*60)
    test_request_id = test_submit_verification()
    test_admin_reject(test_request_id)
    
    # Create new request for approval test
    print("\n" + "="*60)
    print("CREATING NEW REQUEST FOR APPROVAL TEST")
    print("="*60)
    test_request_id = test_submit_verification()
    test_admin_approve(test_request_id)
    
    print("\n" + "="*60)
    print("ALL TESTS COMPLETED")
    print("="*60)
