"""Database connection and initialization."""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import cloudinary
import cloudinary.utils
import resend
import logging

from app.config import MONGO_URL, DB_NAME, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, RESEND_API_KEY

log = logging.getLogger("syrlink")

# MongoDB connection with optimized settings for better resilience
try:
    client = AsyncIOMotorClient(
        MONGO_URL,
        serverSelectionTimeoutMS=30000,    # 30 second timeout for server selection
        connectTimeoutMS=30000,             # 30 second timeout for connection
        socketTimeoutMS=30000,              # 30 second timeout for socket operations
        maxPoolSize=50,                     # Connection pool size
        minPoolSize=5,                      # Minimum pool size
        retryWrites=True,
        w='majority',
        heartbeatFrequencyMS=10000,         # Heartbeat every 10 seconds
        serverMonitoringMode='auto',
        connect=False,                      # Don't connect until first operation
    )
    log.info("✓ MongoDB client initialized with resilient settings")
except Exception as e:
    log.error(f"✗ Failed to initialize MongoDB client: {e}")
    raise

db: AsyncIOMotorDatabase = client[DB_NAME]

# Cloudinary configuration
cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
    secure=True,
)

# Resend configuration
resend.api_key = RESEND_API_KEY


def get_db() -> AsyncIOMotorDatabase:
    """Return the database instance."""
    return db


def close_db():
    """Close the database connection."""
    client.close()
