"""Check admin user status in database."""
import asyncio
from app.database import db

async def check_user():
    """Check if basmajienaya@gmail.com exists and their admin status."""
    email = "basmajienaya@gmail.com"
    
    user = await db.users.find_one({"email": email}, {"_id": 0, "password_hash": 0})
    
    if not user:
        print(f"✗ User {email} NOT FOUND in database")
        return
    
    print(f"✓ User found: {email}")
    print(f"  ID: {user.get('id')}")
    print(f"  Name: {user.get('name')}")
    print(f"  is_admin: {user.get('is_admin')} ← THIS IS THE KEY")
    print(f"  verified: {user.get('verified')}")
    print(f"  email_verified: {user.get('email_verified')}")
    print(f"  oauth_provider: {user.get('oauth_provider')}")
    
    if not user.get("is_admin"):
        print("\n⚠️  User is NOT admin! Run: python make_admin.py")
    else:
        print("\n✓ User IS admin - should see Admin Panel")

if __name__ == "__main__":
    asyncio.run(check_user())
