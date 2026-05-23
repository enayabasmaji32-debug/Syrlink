"""pytest configuration and fixtures."""
import pytest
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

# Load .env
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
async def cleanup_db():
    """Clean up test database before each test."""
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    
    if mongo_url and db_name:
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        # Clear collections before test
        yield
        
        # Clear collections after test
        try:
            await db.users.delete_many({})
            await db.posts.delete_many({})
            await db.connections.delete_many({})
            await db.messages.delete_many({})
            await db.post_likes.delete_many({})
        except Exception as e:
            print(f"Cleanup error: {e}")
    else:
        yield
