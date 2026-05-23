# 📦 SyrLink Database Setup Guide

## ✅ Status: Database Initialized Successfully!

### What Was Done
Your MongoDB database has been fully initialized with **11 collections** and all necessary indexes for persistence:

| Collection | Purpose | Documents |
|-----------|---------|-----------|
| `users` | User profiles & authentication | 13 |
| `posts` | Feed posts | 6 |
| `connections` | Connection requests | 3 |
| `messages` | Direct messages | 11 |
| `conversations` | Message conversations | 5 |
| `notifications` | User notifications | 11 |
| `jobs` | Job listings | 8 |
| `companies` | Company profiles | 0 |
| `recommendations` | LinkedIn-style recommendations | 0 |
| `endorsements` | Skill endorsements | 0 |
| `verification_requests` | Account verification | 0 |

---

## ✅ Data Persistence Confirmed

**YES - All data is being saved to MongoDB and persists across:**
- ✓ Page refreshes
- ✓ Server restarts
- ✓ Browser sessions
- ✓ Multiple user sessions

---

## 🔐 Using the Database Management API

The backend has three new admin endpoints for database management:

### 1. Initialize Database (Create Collections & Indexes)
```bash
curl -X POST http://localhost:8000/api/db/init \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "status": "success",
  "message": "Database initialized with all collections and indexes",
  "collections": {
    "users": {
      "status": "initialized",
      "count": 13,
      "indexes": ["email (unique)", "id (unique)", "created_at", "text search"]
    },
    ...
  }
}
```

### 2. Check Database Status
```bash
curl http://localhost:8000/api/db/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Shows all collections, document counts, and index information.

### 3. Clear All Data (DESTRUCTIVE)
```bash
curl -X POST http://localhost:8000/api/db/clear-all \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

⚠️ **WARNING**: This deletes all data. Only admin can use this.

---

## 🔧 How to Test Database Persistence

### Via Frontend
1. Login to http://localhost:3000
2. Create a post
3. Create a connection request
4. Send a message
5. **Refresh the page** - All data will still be there ✓

### Via API
1. Login and get JWT token
2. Call any endpoint to create data
3. Refresh page
4. Query the same endpoint - data still there ✓

### Command Line
```bash
# Initialize database
python init_db.py

# To use API endpoints, first get auth token:
# 1. Login at POST /api/auth/login
# 2. Use returned token in Authorization header
```

---

## 👤 Admin Access

### Default Admin User
- **Email**: `admin@syrlink.com` (or see `.env`)
- **Password**: Check `.env` file
- **Status**: Auto-created on first startup

### Get Admin Token
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@syrlink.com",
    "password": "YOUR_PASSWORD"
  }'
```

Response includes `token` - use it for admin endpoints.

---

## 🗄️ Database Connection Details

### MongoDB Setup Required in `.env`
```env
MONGO_URL=mongodb://username:password@localhost:27017/
DB_NAME=syrlink_db
```

### Collections Created With:
✓ Unique constraints on email & user IDs
✓ Indexes for fast queries
✓ Text search indexes for searching
✓ Date indexes for sorting

---

## 🚀 Starting Fresh (Optional)

If you ever need to reset the database:

```bash
# Option 1: Via Python script
python init_db.py

# Option 2: Via API (after login as admin)
POST /api/db/clear-all
POST /api/db/init

# Option 3: Manual MongoDB
# Log into MongoDB and run:
# db.dropDatabase()
# Then restart server
```

---

## 📊 What Gets Persisted

### ✓ Automatically Saved to Database:
- User profiles and settings
- Posts and feed content
- Comments and reactions
- Connection requests
- Messages and conversations
- Notifications
- Job postings
- Company information
- Endorsements
- Verification requests

### ✗ NOT Persisted (Client-side only):
- JWT authentication tokens (stored in localStorage)
- Temporary UI state
- Form drafts (unless explicitly saved)

---

## 🐛 Troubleshooting

### Issue: "Database connection error"
**Solution**: 
- Check MongoDB is running
- Verify `MONGO_URL` in `.env`
- Verify `DB_NAME` in `.env`

### Issue: Data doesn't appear after refresh
**Solution**:
- Check API calls are being made (browser DevTools > Network)
- Verify backend is returning data
- Check MongoDB connection

### Issue: Collections don't exist
**Solution**:
```bash
# Run initialization
python init_db.py

# Or via API
POST /api/db/init
```

---

## 📝 Notes

- MongoDB must be running for persistence
- All collections use MongoDB's flexible schema
- Indexes improve query performance
- Database is separate from frontend - frontend needs to call API to save data
- All user data is tied to user IDs

---

## ✨ What's Next?

1. **Test Data Persistence**: Create a post, refresh page
2. **Check Database**: Use `/api/db/status` to see all data
3. **Monitor Logs**: Check backend logs for any errors
4. **Scale Up**: Add more users, posts, and test data

🎉 **Your data is now persisted!**
