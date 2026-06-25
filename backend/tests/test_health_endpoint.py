import pytest
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_root_health():
    async with AsyncClient(app=app, base_url="http://test") as client:
        r = await client.get("/api/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"


@pytest.mark.asyncio
async def test_cloudinary_signature_requires_auth():
    async with AsyncClient(app=app, base_url="http://test") as client:
        r = await client.get("/api/cloudinary/signature")
        # should be unauthorized because no auth provided
        assert r.status_code in (401, 403)
