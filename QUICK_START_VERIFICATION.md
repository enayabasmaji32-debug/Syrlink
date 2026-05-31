# Quick Start Guide - Professional Verification System

## 🎯 5-Minute Setup

### 1. Start Backend
```bash
cd backend
pip install -r requirements.txt
python server.py
```
Backend runs on: `http://localhost:8000`

### 2. Start Frontend
```bash
cd frontend
npm install
npm start
```
Frontend runs on: `http://localhost:3000`

### 3. Login as User
1. Go to http://localhost:3000
2. Sign up or login with test credentials
3. Navigate to Profile page
4. Click "Request Verification Badge"

### 4. Login as Admin
1. Open new browser tab to http://localhost:3000
2. Login with admin account: `admin@example.com` / `password`
3. Go to Admin Panel (look for admin menu)
4. Click "Verifications" tab
5. See pending verification requests

---

## 🔍 Test Verification Flow

### Step 1: Submit Request (as User)
```
Profile → Request Verification Badge
├─ Select Document Type: "ID"
├─ Upload File: document.pdf
├─ Add Note: "My national ID card"
└─ Click "Submit"
```

**Result**: See Request ID like `VR-ABC123`

### Step 2: View as Admin
```
Admin Panel → Verifications Tab
└─ See your request with ID, stage, document link
```

### Step 3: Move Through Stages (as Admin)
```
Click stage buttons in order:
├─ 🔍 IDENTITY_CHECK (blue = current)
├─ 👤 FACE_MATCH
├─ ⏳ UNDER_REVIEW
└─ ✓ FINAL_DECISION
```

**Result**: User gets notified of stage changes

### Step 4: Approve Request
```
Click "Approve" button
```

**Result**: 
- User becomes verified
- Verification badge appears on profile
- User gets approval notification

### Step 5: Check User Status
```
Go back to user profile
├─ See Verification Tracking section
├─ Status shows: "APPROVED" ✓
└─ All 4 stages marked as complete
```

---

## 🔧 Common Commands

### Database
```bash
# View verification requests
db.verification_requests.find()

# Find by user
db.verification_requests.findOne({"user_id": "USER_ID"})

# Find by request ID
db.verification_requests.findOne({"request_id": "VR-ABC123"})

# Count pending
db.verification_requests.countDocuments({"status": "pending"})
```

### Frontend Debugging
```bash
# Open browser console (F12)
# Check verification data
fetch('/api/verification/me').then(r => r.json()).then(console.log)

# Check all verifications (as admin)
fetch('/api/admin/verification-requests?status=pending')
  .then(r => r.json()).then(console.log)
```

### Testing Script
```bash
cd syrlink_fixed
python test_verification_system.py
```

---

## 📁 Key Files to Know

| File | Purpose |
|------|---------|
| `backend/app/models.py` | Data models, constants |
| `backend/app/routes/other.py` | Verification API endpoints |
| `frontend/src/components/VerificationRequestProfessional.jsx` | Submit form |
| `frontend/src/components/VerificationTracking.jsx` | Status dashboard |
| `frontend/src/pages/AdminPanel.jsx` | Admin management |
| `VERIFICATION_SYSTEM_GUIDE.md` | Full documentation |

---

## 🚨 Troubleshooting

### "No pending verification requests"
- Make sure you submitted a request as a user first
- Check user is different from admin

### Request ID doesn't show
- Check browser console for errors (F12)
- Check backend logs for errors
- Refresh page after submit

### Admin can't see requests
- Verify admin is logged in as user with `is_admin: true`
- Check Admin Panel loads correctly
- Try hard refresh (Ctrl+F5)

### Stages don't update
- Check browser console for API errors
- Verify admin is still logged in
- Try clicking stage button again
- Check backend logs

---

## 📊 Test Data

### Admin Account
- Email: `admin@example.com`
- Password: `AdminPassword123!`

### Test User Account
- Email: `test@example.com`
- Password: `TestPassword123!`

### Test Document
Use any PDF or image file:
- ✅ ID card scan
- ✅ Certificate image
- ✅ Degree PDF
- ✅ Any document

---

## 🎓 Learning Path

### Beginner
1. Read this file (5 min)
2. Run the quick start (5 min)
3. Submit a verification request (5 min)
4. Review as admin (5 min)

### Intermediate
1. Read `VERIFICATION_SYSTEM_GUIDE.md` (15 min)
2. Review code in `backend/app/routes/other.py` (15 min)
3. Review components in `frontend/src/components/` (15 min)
4. Run test script (10 min)

### Advanced
1. Study database schema changes
2. Review notification system integration
3. Add email notifications (feature)
4. Set up certificate generation (feature)

---

## 🔄 API Examples

### Submit Verification
```javascript
// Frontend
const response = await fetch('/api/verification/request', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    document_url: 'https://cloudinary.com/...',
    document_type: 'id',
    note: 'My national ID'
  })
});
const data = await response.json();
console.log(data.id); // Shows request ID like VR-ABC123
```

### Admin Update Stage
```javascript
// Frontend (Admin)
const response = await fetch(
  `/api/admin/verification-requests/${requestId}/stage?new_stage=face_match`,
  { method: 'POST' }
);
```

### Admin Approve
```javascript
// Frontend (Admin)
const response = await fetch(
  `/api/admin/verification-requests/${requestId}/approve`,
  { method: 'POST' }
);
```

### Admin Reject
```javascript
// Frontend (Admin)
const response = await fetch(
  `/api/admin/verification-requests/${requestId}/reject?reason=Document%20unclear`,
  { method: 'POST' }
);
```

---

## ✅ Verification Checklist

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Can login as user
- [ ] Can login as admin
- [ ] Can submit verification request
- [ ] Can see Request ID
- [ ] Admin sees pending request
- [ ] Can move through stages
- [ ] Can approve request
- [ ] User sees status update
- [ ] Can reject request
- [ ] User sees rejection reason
- [ ] Notifications appear

---

## 📞 Need Help?

1. **Check the docs**: `VERIFICATION_SYSTEM_GUIDE.md`
2. **Read the code**: Comments in source files
3. **Run the tests**: `test_verification_system.py`
4. **Check logs**: Terminal output from backend
5. **Browser console**: F12 → Console → Check for errors

---

## 🎉 You're Ready!

The professional verification system is working. Start with Step 1 and progress through the test flow.

**Questions?** See `VERIFICATION_SYSTEM_GUIDE.md` for detailed docs.

Happy verifying! 🚀
