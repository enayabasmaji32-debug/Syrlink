"""
Database cleanup script to remove duplicates and fix data issues.
Run this once to fix any database problems preventing registration.

Usage: 
  python cleanup_db.py              # Run full cleanup
  python cleanup_db.py --reset      # Delete ALL users (⚠️ for testing only)
  python cleanup_db.py --verify     # Just verify data integrity
"""
import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import errors

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

if not MONGO_URL or not DB_NAME:
    print("❌ Error: MONGO_URL and DB_NAME must be set in .env")
    sys.exit(1)


async def cleanup_database(reset_all=False, verify_only=False):
    """Clean up database issues and remove duplicates."""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print(f"🔧 Connecting to MongoDB: {DB_NAME}...")
    
    try:
        await db.command("ping")
        print("✓ Connected to MongoDB\n")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        sys.exit(1)

    try:
        # Mode 1: Reset all (dangerous - for testing only)
        if reset_all:
            print("⚠️  WARNING: About to DELETE ALL USERS!")
            confirm = input("Type 'YES' to confirm: ").strip()
            if confirm != 'YES':
                print("Cancelled.")
                return
            
            result = await db.users.delete_many({})
            print(f"✓ Deleted {result.deleted_count} users")
            
            # Recreate indexes
            await db.users.create_index("email", unique=True)
            await db.users.create_index("id", unique=True)
            print("✓ Recreated indexes")
            return
        
        # Mode 2: Verify only
        if verify_only:
            print("📊 Database Status:")
            total_users = await db.users.count_documents({})
            verified_users = await db.users.count_documents({"email_verified": True})
            unverified_users = await db.users.count_documents({"email_verified": False})
            
            print(f"  Total users: {total_users}")
            print(f"  ✓ Verified: {verified_users}")
            print(f"  ⏳ Unverified: {unverified_users}\n")
            
            # Check for issues
            null_emails = await db.users.count_documents({"email": {"$in": [None, ""]}})
            if null_emails > 0:
                print(f"  ⚠️  {null_emails} users with null/empty emails")
            else:
                print(f"  ✓ No null/empty emails found")
            
            return
        
        # Mode 3: Full cleanup (default)
        print("🧹 Running full database cleanup...\n")
        
        # Step 1: Remove duplicate emails (keep first, delete rest)
        print("📍 Step 1: Removing duplicate emails...")
        
        # Get all emails
        all_users = await db.users.find({}).to_list(None)
        emails = {}
        duplicates_found = 0
        
        for user in all_users:
            email = user.get("email", "").lower()
            if email:
                if email not in emails:
                    emails[email] = []
                emails[email].append(user["_id"])
        
        # Remove duplicates
        for email, ids in emails.items():
            if len(ids) > 1:
                duplicates_found += len(ids) - 1
                # Keep first, delete rest
                for oid in ids[1:]:
                    await db.users.delete_one({"_id": oid})
                print(f"  ⚠️  Removed {len(ids) - 1} duplicate(s) for {email}")
        
        if duplicates_found == 0:
            print(f"  ✓ No duplicates found")
        else:
            print(f"✓ Removed {duplicates_found} duplicate users\n")
        
        # Step 2: Fix email indexes
        print("📍 Step 2: Fixing email indexes...")
        try:
            # Drop existing email index if it exists
            await db.users.collection.drop_index("email_1")
            print("  ✓ Dropped old email index")
        except:
            pass
        
        # Create new unique email index
        try:
            await db.users.create_index("email", unique=True)
            await db.users.create_index("id", unique=True)
            print("  ✓ Created new unique indexes\n")
        except Exception as e:
            print(f"  ⚠️  Index creation: {e}\n")
        
        # Step 3: Check for null/empty emails
        print("📍 Step 3: Removing users with invalid emails...")
        null_count = await db.users.count_documents({"email": {"$in": [None, ""]}})
        if null_count > 0:
            result = await db.users.delete_many({"email": {"$in": [None, ""]}})
            print(f"  ⚠️  Removed {result.deleted_count} users with null/empty emails\n")
        else:
            print(f"  ✓ No invalid emails found\n")
        
        # Step 4: Verify email counts
        print("📍 Step 4: Final verification...")
        total_users = await db.users.count_documents({})
        verified_users = await db.users.count_documents({"email_verified": True})
        unverified_users = await db.users.count_documents({"email_verified": False})
        
        print(f"  📊 Total users: {total_users}")
        print(f"  ✓ Verified: {verified_users}")
        print(f"  ⏳ Unverified: {unverified_users}\n")
        
        print("✅ Database cleanup completed successfully!")
        print("\nYou can now proceed with registration.\n")
        
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        client.close()


if __name__ == "__main__":
    reset_all = "--reset" in sys.argv
    verify_only = "--verify" in sys.argv
    
    asyncio.run(cleanup_database(reset_all=reset_all, verify_only=verify_only))
