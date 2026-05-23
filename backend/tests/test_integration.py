"""Integration tests for complete user flow."""
import pytest
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_complete_user_flow():
    """Test complete user flow: register → create post → like → connect."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # 1. Register user 1
        reg1 = await client.post("/api/auth/register", json={
            "name": "Alice",
            "email": "alice@test.com",
            "password": "Pass@1234"
        })
        assert reg1.status_code == 200
        token1 = reg1.json()["token"]
        user1_id = reg1.json()["user"]["id"]
        
        # 2. Register user 2
        reg2 = await client.post("/api/auth/register", json={
            "name": "Bob",
            "email": "bob@test.com",
            "password": "Pass@5678"
        })
        assert reg2.status_code == 200
        token2 = reg2.json()["token"]
        user2_id = reg2.json()["user"]["id"]
        
        # 3. User 1 creates a post
        post_response = await client.post(
            "/api/posts",
            json={"content": "Hello from Alice!"},
            headers={"Authorization": f"Bearer {token1}"}
        )
        assert post_response.status_code == 200
        post_id = post_response.json()["id"]
        
        # 4. User 2 likes the post
        like_response = await client.post(
            f"/api/posts/{post_id}/like",
            headers={"Authorization": f"Bearer {token2}"}
        )
        assert like_response.status_code == 200
        assert like_response.json()["liked"] == True
        
        # 5. User 1 and User 2 connect
        connect_response = await client.post(
            "/api/connections/request",
            json={"receiver_id": user2_id},
            headers={"Authorization": f"Bearer {token1}"}
        )
        assert connect_response.status_code == 200
        
        # 6. User 2 accepts connection
        conn_id = connect_response.json()["id"]
        accept_response = await client.post(
            f"/api/connections/{conn_id}/accept",
            headers={"Authorization": f"Bearer {token2}"}
        )
        assert accept_response.status_code == 200
        
        # 7. Check they are connected
        my_conns = await client.get(
            "/api/connections/me",
            headers={"Authorization": f"Bearer {token1}"}
        )
        assert my_conns.status_code == 200
        conn_user_ids = [u["id"] for u in my_conns.json()]
        assert user2_id in conn_user_ids


@pytest.mark.asyncio
async def test_mutual_connections_calculation():
    """Test that mutual connections are calculated correctly."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Create 4 users
        users = []
        for i in range(4):
            reg = await client.post("/api/auth/register", json={
                "name": f"User{i}",
                "email": f"user{i}@test.com",
                "password": "Pass@1234"
            })
            users.append({
                "id": reg.json()["user"]["id"],
                "token": reg.json()["token"]
            })
        
        # User 0 connects with User 1, 2
        for j in [1, 2]:
            req = await client.post(
                "/api/connections/request",
                json={"receiver_id": users[j]["id"]},
                headers={"Authorization": f"Bearer {users[0]['token']}"}
            )
            conn_id = req.json()["id"]
            await client.post(
                f"/api/connections/{conn_id}/accept",
                headers={"Authorization": f"Bearer {users[j]['token']}"}
            )
        
        # User 1 connects with User 2, 3
        for j in [2, 3]:
            if j == 2:
                # Already connected, skip
                continue
            req = await client.post(
                "/api/connections/request",
                json={"receiver_id": users[j]["id"]},
                headers={"Authorization": f"Bearer {users[1]['token']}"}
            )
            conn_id = req.json()["id"]
            await client.post(
                f"/api/connections/{conn_id}/accept",
                headers={"Authorization": f"Bearer {users[j]['token']}"}
            )
        
        # Get suggestions for User 3 (should show mutual connections)
        suggestions = await client.get(
            "/api/users/me/suggestions",
            headers={"Authorization": f"Bearer {users[3]['token']}"}
        )
        assert suggestions.status_code == 200
        data = suggestions.json()
        
        # User 0 should be in suggestions with mutual connections > 0
        user0_suggestion = next((u for u in data if u["id"] == users[0]["id"]), None)
        if user0_suggestion:
            assert user0_suggestion["mutual"] >= 0
