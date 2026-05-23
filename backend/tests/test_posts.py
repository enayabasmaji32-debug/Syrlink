"""Posts endpoints tests."""
import pytest
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_create_post_authenticated():
    """Test creating a post while authenticated."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Register and login
        reg_response = await client.post("/api/auth/register", json={
            "name": "Post Creator",
            "email": "poster@example.com",
            "password": "Pass@1234"
        })
        token = reg_response.json()["token"]
        
        # Create post
        response = await client.post(
            "/api/posts",
            json={"content": "Hello World!", "visibility": "Anyone"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["content"] == "Hello World!"
        assert data["author"]["name"] == "Post Creator"


@pytest.mark.asyncio
async def test_create_post_unauthenticated():
    """Test creating a post without authentication."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/posts",
            json={"content": "Hello World!"}
        )
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_posts():
    """Test listing posts."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Register and create post
        reg_response = await client.post("/api/auth/register", json={
            "name": "Poster",
            "email": "lister@example.com",
            "password": "Pass@1234"
        })
        token = reg_response.json()["token"]
        
        await client.post(
            "/api/posts",
            json={"content": "Test Post"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # List posts
        response = await client.get(
            "/api/posts",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) > 0


@pytest.mark.asyncio
async def test_post_rate_limiting():
    """Test rate limiting on post creation (10/minute)."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Register
        reg_response = await client.post("/api/auth/register", json={
            "name": "Rate Test",
            "email": "ratetest@example.com",
            "password": "Pass@1234"
        })
        token = reg_response.json()["token"]
        
        # Try to create 12 posts (limit is 10/minute)
        responses = []
        for i in range(12):
            response = await client.post(
                "/api/posts",
                json={"content": f"Post {i}"},
                headers={"Authorization": f"Bearer {token}"}
            )
            responses.append(response.status_code)
        
        # Last 2 should be rate limited (429)
        assert any(status == 429 for status in responses[-2:])
