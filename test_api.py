#!/usr/bin/env python3
"""Quick test of posts and messages API endpoints."""
import asyncio
import httpx
import json
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.database import db
from app.security import create_token
from app.utils import uid

# Test user ID
TEST_USER_ID = "test_user_" + uid()

async def test_api():
    """Test create post and send message endpoints."""
    
    # Get or create test user
    user = await db.users.find_one({"email": "test@test.com"})
    if not user:
        user = {
            "id": TEST_USER_ID,
            "email": "test@test.com",
            "name": "Test User",
            "password": "hashed",
            "avatar": "",
            "created_at": "2024-01-01T00:00:00Z",
        }
        await db.users.insert_one(user)
    
    test_user_id = user["id"]
    
    # Create token
    token = create_token(test_user_id, user["email"])
    
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Test 1: Create post
        print("\n=== TEST 1: Create Post ===")
        post_data = {
            "content": "Test post from API test",
            "image": None,
            "visibility": "Anyone",
            "company_id": None
        }
        
        headers = {"Authorization": f"Bearer {token}"}
        try:
            response = await client.post(
                "/api/posts",
                json=post_data,
                headers=headers,
                timeout=10.0
            )
            print(f"Status: {response.status_code}")
            if response.status_code in [200, 201]:
                print(f"Response: {response.json()}")
            else:
                print(f"Error: {response.text}")
        except Exception as e:
            print(f"Exception: {e}")
        
        # Test 2: List posts
        print("\n=== TEST 2: List Posts ===")
        try:
            response = await client.get(
                "/api/posts",
                headers=headers,
                timeout=10.0
            )
            print(f"Status: {response.status_code}")
            data = response.json()
            print(f"Posts count: {len(data.get('items', []))}")
            if data.get('items'):
                print(f"First post: {data['items'][0]}")
        except Exception as e:
            print(f"Exception: {e}")
        
        # Test 3: Create conversation
        print("\n=== TEST 3: Create Conversation ===")
        other_user = await db.users.find_one({"id": {"$ne": test_user_id}})
        if other_user:
            conv_data = {"user_id": other_user["id"]}
            try:
                response = await client.post(
                    "/api/conversations",
                    json=conv_data,
                    headers=headers,
                    timeout=10.0
                )
                print(f"Status: {response.status_code}")
                if response.status_code in [200, 201]:
                    conv = response.json()
                    print(f"Conversation ID: {conv.get('id')}")
                    
                    # Test 4: Send message
                    print("\n=== TEST 4: Send Message ===")
                    msg_data = {"text": "Test message"}
                    response = await client.post(
                        f"/api/conversations/{conv['id']}/messages",
                        json=msg_data,
                        headers=headers,
                        timeout=10.0
                    )
                    print(f"Status: {response.status_code}")
                    if response.status_code in [200, 201]:
                        print(f"Message: {response.json()}")
                    else:
                        print(f"Error: {response.text}")
                else:
                    print(f"Error: {response.text}")
            except Exception as e:
                print(f"Exception: {e}")
        else:
            print("No other users found to test conversation")

if __name__ == "__main__":
    asyncio.run(test_api())
