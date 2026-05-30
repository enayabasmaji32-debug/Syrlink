"""Make basmajienaya@gmail.com an admin - creates if not exists."""
import asyncio
from app.database import db
from app.utils import uid, now_iso
from app.security import hash_password

async def make_admin():
    """Ensure basmajienaya@gmail.com exists and is admin."""
    email = "basmajienaya@gmail.com"
    
    user = await db.users.find_one({"email": email})
    
    if not user:
        print(f"✓ Creating admin user {email}")
        user_id = uid()
        user = {
            "id": user_id,
            "name": "Admin",
            "email": email,
            "avatar": f"https://api.dicebear.com/7.x/initials/svg?seed={email}",
            "cover": "https://images.unsplash.com/photo-1497215728101-856f4ea42174",
            "headline": "SyrLink Administrator",
            "location": "Syria",
            "about": "Platform Administrator",
            "verified": True,
            "email_verified": True,
            "is_admin": True,
            "password_hash": hash_password("Admin@SyrLink2026"),
            "oauth_provider": None,
            "experience": [],
            "education": [],
            "skills": [],
            "languages": [],
            "connections": 0,
            "created_at": now_iso(),
            "last_seen": now_iso(),
        }
        await db.users.insert_one(user)
        print(f"✓ Admin user created with ID: {user_id}")
    else:
        print(f"✓ User {email} exists, updating to admin...")
        await db.users.update_one(
            {"email": email},
            {"$set": {"is_admin": True, "verified": True}}
        )
        user = await db.users.find_one({"email": email})
    
    print(f"✓ {email} is now admin")
    print(f"  User ID: {user.get('id')}")
    print(f"  Name: {user.get('name')}")
    print(f"  is_admin: {user.get('is_admin')}")
    print(f"  verified: {user.get('verified')}")
    print(f"  email_verified: {user.get('email_verified')}")

if __name__ == "__main__":
    asyncio.run(make_admin())


