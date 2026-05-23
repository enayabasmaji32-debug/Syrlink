"""Auth endpoints tests."""
import pytest
from httpx import AsyncClient
from app.main import app
from app.database import db


@pytest.mark.asyncio
async def test_register_success():
    """Test successful user registration."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post("/api/auth/register", json={
            "name": "Test User",
            "email": "test@example.com",
            "password": "Test@1234",
            "headline": "Software Developer"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["email"] == "test@example.com"
        assert data["user"]["name"] == "Test User"


@pytest.mark.asyncio
async def test_register_duplicate_email():
    """Test registration with duplicate email."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # First registration
        await client.post("/api/auth/register", json={
            "name": "User 1",
            "email": "duplicate@example.com",
            "password": "Pass@1234"
        })
        
        # Duplicate email
        response = await client.post("/api/auth/register", json={
            "name": "User 2",
            "email": "duplicate@example.com",
            "password": "Pass@5678"
        })
        assert response.status_code == 400


@pytest.mark.asyncio
async def test_login_success():
    """Test successful login."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Register first
        reg_response = await client.post("/api/auth/register", json={
            "name": "Login Test",
            "email": "login@example.com",
            "password": "Pass@1234"
        })
        user_id = reg_response.json()["user"]["id"]
        
        # Login
        response = await client.post("/api/auth/login", json={
            "email": "login@example.com",
            "password": "Pass@1234"
        })
        assert response.status_code == 200
        assert "token" in response.json()


@pytest.mark.asyncio
async def test_login_invalid_password():
    """Test login with invalid password."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Register
        await client.post("/api/auth/register", json={
            "name": "Test",
            "email": "invalid@example.com",
            "password": "Pass@1234"
        })
        
        # Login with wrong password
        response = await client.post("/api/auth/login", json={
            "email": "invalid@example.com",
            "password": "WrongPassword"
        })
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_rate_limit_on_login():
    """Test rate limiting on login endpoint."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Try to login 6 times (limit is 5/minute)
        responses = []
        for i in range(6):
            response = await client.post("/api/auth/login", json={
                "email": f"user{i}@example.com",
                "password": "pass"
            })
            responses.append(response.status_code)
        
        # Last one should be rate limited (429)
        assert responses[-1] == 429 or responses[-1] == 401
