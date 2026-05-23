"""Script to verify and fix admin privileges."""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
from dotenv import load_dotenv
import os

# Load environment
load_dotenv(Path(__file__).parent / ".env")

async def fix_admin():
    """Verify and fix admin account."""
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@syrlink.com").lower()
    
    print(f"\n🔍 Checking admin account: {admin_email}\n")
    
    # Find admin user
    user = await db.users.find_one({"email": admin_email})
    
    if not user:
        print(f"❌ Admin user not found with email: {admin_email}")
        client.close()
        return False
    
    print(f"✓ User found: {user.get('name')}")
    print(f"  Email: {user.get('email')}")
    print(f"  is_admin: {user.get('is_admin', False)}")
    print(f"  verified: {user.get('verified', False)}")
    
    # Fix admin flags
    if not user.get("is_admin") or not user.get("verified"):
        print(f"\n⚠️  Fixing admin flags...")
        result = await db.users.update_one(
            {"email": admin_email},
            {"$set": {"is_admin": True, "verified": True}}
        )
        print(f"✓ Updated {result.modified_count} user")
        print(f"✓ Admin privileges granted!")
    else:
        print(f"\n✓ Admin account is properly configured!")
    
    client.close()
    return True

if __name__ == "__main__":
    success = asyncio.run(fix_admin())
    if not success:
        print("\n❌ Could not verify admin account")
        exit(1)
    print("\n✅ Done! Try logging in again.\n")
