# Professional Verification System Guide

## 🎯 Overview

The SyrLink verification system has been enhanced to provide a professional, multi-stage verification process for users seeking verification badges. The system now supports:

- **4-Stage Verification Process**: Identity Check → Face Match → Under Review → Final Decision
- **Global Request Tracking**: Each request gets a unique ID (e.g., VR-ABC123) for support inquiries
- **Admin Stage Management**: Move requests through verification stages with visual progress
- **User Status Tracking**: Real-time status updates and rejection reasons
- **Notification System**: Users receive updates at each stage change

---

## 🚀 User Flow

### 1. Request Verification

**Location**: User Profile Page

**Steps**:
1. Click "Request Verification Badge" button
2. Select document type (ID, Certificate, Degree, Other)
3. Upload document via drag-and-drop or file picker
4. Add optional notes explaining the request
5. Review and submit
6. Receive confirmation with unique `Request ID`

**UI**: 4-step professional form with progress indicators

**Result**: Verification request created with status "pending"

### 2. Track Status

**Location**: User Profile Page (Verification Tracking Section)

**Displays**:
- Current status (pending/approved/rejected)
- Stage progress (4 visual indicators)
- Document details
- Submission date
- Rejection reason (if rejected)

**Auto-updates**: When admin changes stage or approves/rejects

---

## 🛠️ Admin Flow

### 1. View Pending Requests

**Location**: Admin Panel → Verifications Tab

**Displays**:
- User profile photo and name
- Unique Request ID (copyable, for support)
- Current stage badge
- Document type and notes
- Submitted date
- Document preview link

### 2. Review & Manage Stages

**Stage Progression**:
```
🔍 IDENTITY_CHECK → 👤 FACE_MATCH → ⏳ UNDER_REVIEW → ✓ FINAL_DECISION
```

**Actions**:
- **Click stage buttons**: Move request to that stage (auto-completes previous stages)
- **"Approve" button**: Set status to "approved" and add verification badge to user
- **"Reject" button**: Open prompt for rejection reason, then reject with message

**Visual Feedback**:
- Completed stages: Green background
- Current stage: Blue border
- Future stages: Gray background (clickable)

### 3. Notifications

When admin moves a request through stages:

**Stage Changed Notification**:
```
"Your verification request is now in [Stage Name]. 
Please wait while we review your submission."
```

**Approved Notification**:
```
"🎉 Congratulations! Your verification request has been approved.
You now have a verification badge."
```

**Rejected Notification**:
```
"Your verification request was reviewed — [Admin Reason]"
```

---

## 📊 Database Schema

### verification_requests Collection

```javascript
{
  // Core Fields
  id: String,              // Unique request identifier (e.g., "VR-ABC123")
  user_id: String,         // Reference to user who submitted
  status: String,          // "pending" | "approved" | "rejected"
  
  // Document Fields
  document_url: String,    // Cloudinary URL of uploaded file
  document_type: String,   // "id" | "certificate" | "degree" | "other"
  note: String,            // Optional user note
  
  // Stage Tracking
  current_stage: String,   // "identity_check" | "face_match" | "under_review" | "final_decision"
  stages_completed: Array, // ["identity_check", "face_match"]
  
  // Review Fields
  rejection_reason: String,// Optional reason for rejection
  reviewed_at: String,     // ISO timestamp of final decision
  reviewed_by: String,     // Admin user ID who reviewed
  
  // Timestamps
  created_at: String,      // ISO timestamp of submission
  updated_at: String       // ISO timestamp of last update
}
```

---

## 🔌 API Endpoints

### User Endpoints

#### Submit Verification Request
```http
POST /verification/request
Content-Type: application/json

{
  "document_url": "https://cloudinary.com/...",
  "document_type": "id",
  "note": "My national ID"
}

Response:
{
  "id": "VR-ABC123",
  "status": "pending",
  "current_stage": "identity_check",
  "stages_completed": [],
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### Get User's Verification Status
```http
GET /verification/me

Response:
{
  "id": "VR-ABC123",
  "status": "pending",
  "current_stage": "face_match",
  "stages_completed": ["identity_check"],
  "document_type": "id",
  "created_at": "2024-01-15T10:30:00Z",
  "reviewed_at": null,
  "rejection_reason": null
}
```

### Admin Endpoints

#### Get Pending Verifications
```http
GET /admin/verification-requests?status=pending

Response: [
  {
    "id": "VR-ABC123",
    "user": { "id": "...", "name": "...", "email": "...", "avatar": "..." },
    "document_type": "id",
    "document_url": "...",
    "note": "...",
    "status": "pending",
    "current_stage": "identity_check",
    "stages_completed": [],
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

#### Move Verification Through Stage
```http
POST /admin/verification-requests/{id}/stage?new_stage=face_match

Response:
{
  "ok": true
}
```

#### Approve Verification
```http
POST /admin/verification-requests/{id}/approve

Response:
{
  "ok": true
}
```

#### Reject Verification
```http
POST /admin/verification-requests/{id}/reject?reason=Document%20unclear

Response:
{
  "ok": true
}
```

---

## 🎨 Frontend Components

### VerificationRequestProfessional.jsx

**Purpose**: 4-step professional form for requesting verification

**Props**:
- `onClose`: Callback when dialog closes

**Features**:
- Document type selector with icons
- Drag-and-drop file upload
- Document preview
- Notes textarea
- Progress bar (4 steps)
- Success screen with Request ID

**Location**: `frontend/src/components/VerificationRequestProfessional.jsx`

### VerificationTracking.jsx

**Purpose**: Dashboard showing user's verification status

**Props**: None (reads from API)

**Features**:
- Status badge (pending/approved/rejected)
- Stage progress visualization
- Document details
- Timeline
- Rejection reason display
- Help text

**Location**: `frontend/src/components/VerificationTracking.jsx`

---

## 🔐 Security Considerations

1. **Document URLs**: Stored as Cloudinary URLs with signed tokens
2. **Admin Access**: Only `is_admin: true` users can access admin endpoints
3. **Request ID**: Unique per request, impossible to guess
4. **Notifications**: Only sent to verified user IDs
5. **Audit Trail**: All actions tracked with `reviewed_by` and timestamps

---

## 📝 Implementation Notes

### Stage Progression Logic

When an admin clicks a stage button:
1. Check if stage is valid
2. Add stage to `stages_completed` array (if not already present)
3. Set `current_stage` to selected stage
4. Send notification to user about stage change

### Approval Logic

When admin clicks "Approve":
1. Set `status: "approved"`
2. Set `current_stage: "final_decision"`
3. Add all stages to `stages_completed`
4. Update user with `verified_badge: true`
5. Send approval notification
6. Create notification

### Rejection Logic

When admin enters rejection reason:
1. Set `status: "rejected"`
2. Store `rejection_reason`
3. Set `reviewed_at` to current time
4. Send rejection notification with reason

---

## 🚨 Troubleshooting

### Request ID Not Showing

**Problem**: User doesn't see Request ID after submission

**Solution**:
1. Check backend logs for errors
2. Verify `request_id` is generated in `submit_verification()` function
3. Ensure database insert is successful

### Stage Changes Not Appearing

**Problem**: Admin moves stage but user doesn't see update

**Solution**:
1. Check notification system is working
2. Verify user receives notification (check `/notifications` endpoint)
3. Check frontend is polling `verificationApi.me()` regularly

### Rejected Reason Not Showing

**Problem**: User doesn't see rejection reason

**Solution**:
1. Ensure `rejection_reason` field is populated in database
2. Check VerificationTracking component correctly displays `rejection_reason`
3. Verify API returns the field

---

## 📈 Future Enhancements

1. **Email Notifications**: Send email at each stage change
2. **Certificate Generation**: Generate PDF certificate upon approval
3. **Timeline View**: Interactive timeline of verification process
4. **Appeal Process**: Allow users to appeal rejections
5. **Bulk Actions**: Admin can approve/reject multiple at once
6. **Analytics**: Track verification success rates by document type
7. **Custom Badges**: Different badge types for different professions
8. **Integration**: Link with external verification services

---

## 🔄 Database Migration (For Existing Requests)

If you have existing verification requests, you may need to run a migration:

```python
# Add missing fields to existing verification requests
db.verification_requests.update_many(
    { "request_id": { "$exists": False } },
    [
        { "$set": {
            "request_id": { "$concat": ["VR-", { "$substr": ["$_id", 0, 6] }] },
            "current_stage": "identity_check",
            "stages_completed": [],
            "rejection_reason": None
        }}
    ]
)
```

---

## 📞 Support

For issues or questions about the verification system:

1. Check the troubleshooting section above
2. Review backend logs: `backend/server.py`
3. Check frontend console for errors: `F12 → Console`
4. Review database directly: Check `verification_requests` collection
5. Contact admin with Request ID for support

---

**Last Updated**: January 2024  
**System Version**: 2.0 (Professional 4-Stage)  
**Status**: Production Ready ✅
