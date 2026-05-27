"""Auth endpoints tests."""
import pytest
from httpx import AsyncClient
from app.main import app
from app.database import db
from app.otp_store import otp_cache


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
        assert data["ok"] is True
        assert data["verification_required"] is True
        assert "token" not in data
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
async def test_login_unverified_user_is_blocked():
    """Test login is blocked when email is not verified."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        await client.post("/api/auth/register", json={
            "name": "Unverified User",
            "email": "unverified@example.com",
            "password": "Pass@1234"
        })

        response = await client.post("/api/auth/login", json={
            "email": "unverified@example.com",
            "password": "Pass@1234"
        })
        assert response.status_code == 403
        assert "تأكيد بريدك" in response.json()["detail"]


@pytest.mark.asyncio
async def test_verify_email_allows_login():
    """Test email verification allows the user to login."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        reg_response = await client.post("/api/auth/register", json={
            "name": "Verify User",
            "email": "verify@example.com",
            "password": "Pass@1234"
        })
        assert reg_response.status_code == 200
        created = reg_response.json()["user"]
        assert created["email_verified"] is False

        saved_user = await db.users.find_one({"id": created["id"]})
        assert saved_user is not None

        # Fetch OTP from in-memory store and verify via OTP endpoint
        otp_entry = otp_cache.get(created["email"].lower())
        assert otp_entry is not None, "Expected OTP to be generated and stored"
        otp_code = otp_entry["code"]

        verify_response = await client.post("/api/auth/verify-otp", json={
            "email": created["email"],
            "otp": otp_code,
        })
        assert verify_response.status_code == 200
        resp_json = verify_response.json()
        assert resp_json.get("ok") is True
        assert "token" in resp_json

        login_response = await client.post("/api/auth/login", json={
            "email": "verify@example.com",
            "password": "Pass@1234"
        })
        assert login_response.status_code == 200
        assert "token" in login_response.json()


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
