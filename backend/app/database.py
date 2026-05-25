"""Database connection and initialization."""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import cloudinary
import cloudinary.utils
import resend

from app.config import MONGO_URL, DB_NAME, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, RESEND_API_KEY

# MongoDB connection with optimized settings
client = AsyncIOMotorClient(
    MONGO_URL,
    serverSelectionTimeoutMS=60000,  # 60 second timeout for server selection
    connectTimeoutMS=60000,           # 60 second timeout for connection
    socketTimeoutMS=60000,            # 60 second timeout for socket operations
    maxPoolSize=100,                  # Connection pool size
    minPoolSize=10,                   # Minimum pool size for better concurrency
    retryWrites=True,
    w='majority',
    heartbeatFrequencyMS=10000,       # Heartbeat every 10 seconds to detect failures faster
)
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
