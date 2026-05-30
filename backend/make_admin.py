"""Make basmajienaya@gmail.com an admin."""
import asyncio
from app.database import db

async def make_admin():
    """Make basmajienaya@gmail.com an admin."""
    email = "basmajienaya@gmail.com"
    
    user = await db.users.find_one({"email": email})
    if not user:
        print(f"✗ User {email} not found in database")
        print("  Run the app startup to auto-create the admin account")
        return
    
    await db.users.update_one(
        {"email": email},
        {"$set": {"is_admin": True, "verified": True}}
    )
    
    print(f"✓ User {email} is now admin with verified badge")
    updated = await db.users.find_one({"email": email})
    print(f"  User ID: {updated.get('id')}")
    print(f"  Name: {updated.get('name')}")
    print(f"  is_admin: {updated.get('is_admin')}")
    print(f"  verified: {updated.get('verified')}")

if __name__ == "__main__":
    asyncio.run(make_admin())

