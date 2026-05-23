"""Database initialization script.
Run this to ensure all collections and indexes are created.

Usage: python init_db.py
"""
import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / "backend" / ".env")

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

if not MONGO_URL or not DB_NAME:
    print("❌ Error: MONGO_URL and DB_NAME must be set in .env")
    sys.exit(1)


async def init_database():
    """Initialize all database collections and indexes."""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print(f"📦 Connecting to MongoDB: {DB_NAME}...")
    
    try:
        # Verify connection
        await db.command("ping")
        print("✓ Connected to MongoDB\n")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        sys.exit(1)

    collections_initialized = 0
    
    # USERS
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("id", unique=True)
        await db.users.create_index([("created_at", -1)])
        await db.users.create_index([("name", "text"), ("headline", "text"), ("about", "text")])
        count = await db.users.count_documents({})
        print(f"✓ Users collection: {count} documents")
        collections_initialized += 1
    except Exception as e:
        print(f"⚠ Users collection: {e}")

    # POSTS
    try:
        await db.posts.create_index([("created_at", -1)])
        await db.posts.create_index([("author_id", 1)])
        await db.posts.create_index([("author_id", 1), ("created_at", -1)])
        await db.posts.create_index([("content", "text")])
        count = await db.posts.count_documents({})
        print(f"✓ Posts collection: {count} documents")
        collections_initialized += 1
    except Exception as e:
        print(f"⚠ Posts collection: {e}")

    # POST_LIKES
    try:
        await db.post_likes.create_index([("post_id", 1), ("user_id", 1)], unique=True)
        await db.post_likes.create_index([("user_id", 1)])
        await db.post_likes.create_index([("created_at", -1)])
        count = await db.post_likes.count_documents({})
        print(f"✓ Post Likes collection: {count} documents")
        collections_initialized += 1
    except Exception as e:
        print(f"⚠ Post Likes collection: {e}")

    # COMMENTS
    try:
        await db.comments.create_index([("post_id", 1), ("created_at", 1)])
        await db.comments.create_index([("author_id", 1)])
        await db.comments.create_index([("post_id", 1)])
        count = await db.comments.count_documents({})
        print(f"✓ Comments collection: {count} documents")
        collections_initialized += 1
    except Exception as e:
        print(f"⚠ Comments collection: {e}")

    # CONNECTIONS
    try:
        await db.connections.create_index([("requester_id", 1), ("receiver_id", 1)])
        await db.connections.create_index([("status", 1), ("created_at", -1)])
        count = await db.connections.count_documents({})
        print(f"✓ Connections collection: {count} documents")
        collections_initialized += 1
    except Exception as e:
        print(f"⚠ Connections collection: {e}")

    # MESSAGES
    try:
        await db.messages.create_index([("conversation_id", 1), ("created_at", -1)])
        await db.messages.create_index([("sender_id", 1)])
        await db.messages.create_index([("conversation_id", 1), ("sender_id", 1), ("read_at", 1)])  # For unread count query
        count = await db.messages.count_documents({})
        print(f"✓ Messages collection: {count} documents")
        collections_initialized += 1
    except Exception as e:
        print(f"⚠ Messages collection: {e}")

    # CONVERSATIONS
    try:
        await db.conversations.create_index([("participants", 1)])
        await db.conversations.create_index([("participants", 1), ("last_message_at", -1)])  # For sorted list queries
        count = await db.conversations.count_documents({})
        print(f"✓ Conversations collection: {count} documents")
        collections_initialized += 1
    except Exception as e:
        print(f"⚠ Conversations collection: {e}")

    # NOTIFICATIONS
    try:
        await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
        await db.notifications.create_index([("user_id", 1), ("read", 1)])
        count = await db.notifications.count_documents({})
        print(f"✓ Notifications collection: {count} documents")
        collections_initialized += 1
    except Exception as e:
        print(f"⚠ Notifications collection: {e}")

    # JOBS
    try:
        await db.jobs.create_index([("created_at", -1)])
        await db.jobs.create_index([("company", 1)])
        await db.jobs.create_index([("title", "text"), ("company", "text"), ("description", "text")])
        count = await db.jobs.count_documents({})
        print(f"✓ Jobs collection: {count} documents")
        collections_initialized += 1
    except Exception as e:
        print(f"⚠ Jobs collection: {e}")

    # COMPANIES
    try:
        await db.companies.create_index("id", unique=True)
        await db.companies.create_index([("name", "text")])
        count = await db.companies.count_documents({})
        print(f"✓ Companies collection: {count} documents")
        collections_initialized += 1
    except Exception as e:
        print(f"⚠ Companies collection: {e}")

    # RECOMMENDATIONS
    try:
        await db.recommendations.create_index([("from_id", 1), ("to_id", 1)], unique=True)
        await db.recommendations.create_index([("to_id", 1), ("created_at", -1)])
        count = await db.recommendations.count_documents({})
        print(f"✓ Recommendations collection: {count} documents")
        collections_initialized += 1
    except Exception as e:
        print(f"⚠ Recommendations collection: {e}")

    # ENDORSEMENTS
    try:
        await db.endorsements.create_index([("from_id", 1), ("user_id", 1), ("skill", 1)], unique=True)
        await db.endorsements.create_index([("user_id", 1), ("skill", 1)])
        count = await db.endorsements.count_documents({})
        print(f"✓ Endorsements collection: {count} documents")
        collections_initialized += 1
    except Exception as e:
        print(f"⚠ Endorsements collection: {e}")

    # VERIFICATION_REQUESTS
    try:
        await db.verification_requests.create_index([("user_id", 1)])
        await db.verification_requests.create_index([("status", 1), ("created_at", -1)])
        count = await db.verification_requests.count_documents({})
        print(f"✓ Verification Requests collection: {count} documents")
        collections_initialized += 1
    except Exception as e:
        print(f"⚠ Verification Requests collection: {e}")

    print(f"\n✅ Database initialized! {collections_initialized}/13 collections ready")
    print("\nNext steps:")
    print("1. Start backend: python server.py")
    print("2. Admin credentials:")
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@syrlink.com")
    print(f"   Email: {admin_email}")
    print(f"   Password: Check your .env file")
    print("3. Login and check /api/db/status for database info")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(init_database())
