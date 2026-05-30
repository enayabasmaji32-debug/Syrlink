"""Reset verification status for all non-admin users."""
import asyncio
from app.database import db

async def reset_verification():
    """Set verified=False for all non-admin users."""
    # Update all non-admin users
    result = await db.users.update_many(
        {"is_admin": {"$ne": True}},
        {"$set": {"verified": False}}
    )
    print(f"✓ Updated {result.modified_count} users: verified set to False")

    # Verify admin still has verified=True
    admin_count = await db.users.count_documents({"is_admin": True, "verified": True})
    print(f"✓ Admins with verified=True: {admin_count}")

    # Check overall counts
    verified_count = await db.users.count_documents({"verified": True})
    unverified_count = await db.users.count_documents({"verified": False})
    print(f"✓ Total verified: {verified_count}, unverified: {unverified_count}")

if __name__ == "__main__":
    asyncio.run(reset_verification())
