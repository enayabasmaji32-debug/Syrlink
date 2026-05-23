# Implementation Guide: Company Posts & Employee Position Requests

## Feature Overview

You now have two major features implemented:

### 1. ✅ Company Posts (Already Existed)
Companies can publish posts directly to the platform feed, just like regular users. Only the company creator can manage these posts.

**Usage:**
- Navigate to a company page
- The company owner will see an "Edit Company" button and post creation options
- Posts appear with company branding (company name, logo, tagline)

---

### 2. ✅ Employee Position Requests (NEW)
This feature allows companies to formally invite employees to join their company page with specific positions (Developer, HR Manager, etc.).

**How it works:**
1. Company owner goes to their company page
2. Sees "Position Requests" section with "Send Request" button
3. Searches for employees on the platform
4. Enters position details (position title, department, description)
5. Sends the request
6. Employee receives notification
7. Employee can accept (joins company immediately) or decline

---

## API Endpoints

### Sending Position Requests
**POST** `/api/companies/{company_id}/position-requests`

Request body:
```json
{
  "employee_id": "user123",
  "position": "Senior Software Engineer",
  "department": "Engineering",
  "description": "Lead backend development team"
}
```

Response:
```json
{
  "id": "req123",
  "company_id": "comp456",
  "employee_id": "user123",
  "position": "Senior Software Engineer",
  "department": "Engineering",
  "description": "Lead backend development team",
  "status": "pending",
  "created_at": "2026-05-22T10:30:00Z",
  "company": {
    "id": "comp456",
    "name": "Tech Company",
    "avatar": "logo_url"
  },
  "employee": {
    "id": "user123",
    "name": "John Doe",
    "avatar": "avatar_url"
  }
}
```

### Getting Received Position Requests (For Employees)
**GET** `/api/position-requests/received?status=pending`

Query parameters:
- `status`: `pending`, `accepted`, `rejected`, or `all` (default: `pending`)

Response:
```json
[
  {
    "id": "req123",
    "company_id": "comp456",
    "employee_id": "user123",
    "position": "Senior Software Engineer",
    "department": "Engineering",
    "description": "Lead backend development team",
    "status": "pending",
    "created_at": "2026-05-22T10:30:00Z",
    "responded_at": null,
    "company": {
      "id": "comp456",
      "name": "Tech Company",
      "avatar": "logo_url",
      "headline": "Innovating the future"
    }
  }
]
```

### Getting Sent Position Requests (For Company Owners)
**GET** `/api/position-requests/sent/{company_id}?status=pending`

Query parameters:
- `status`: `pending`, `accepted`, `rejected`, or `all` (default: `pending`)

Response: Same structure as received requests

### Accepting a Position Request
**PUT** `/api/position-requests/{request_id}/accept`

Response:
```json
{
  "id": "req123",
  "status": "accepted",
  "responded_at": "2026-05-22T11:00:00Z",
  ...
}
```

**Effect:** Employee is immediately added to the company's employee list with the requested position.

### Rejecting a Position Request
**PUT** `/api/position-requests/{request_id}/reject`

Response:
```json
{
  "id": "req123",
  "status": "rejected",
  "responded_at": "2026-05-22T11:00:00Z",
  ...
}
```

---

## Frontend Components

### For Company Owners

#### PositionRequestsList Component
Location: `src/components/PositionRequestsList.jsx`

Shows all position requests sent by the company with:
- Employee avatars and names
- Position titles
- Status (pending/accepted/rejected)
- Date sent
- Status tabs for filtering
- Send Request button

Used in: Company page (only visible to owner)

#### SendPositionRequestModal Component
Location: `src/components/SendPositionRequestModal.jsx`

Features:
- Employee search by name or email
- Position input field
- Optional department field
- Optional description field
- Submit button with loading state
- Error/success messages

### For Employees

#### EmployeePositionRequests Component
Location: `src/components/EmployeePositionRequests.jsx`

Features:
- List of all received position requests
- Company logo and details
- Position information
- Action buttons (Accept/Decline) for pending requests
- Status indicators with icons
- Filter tabs (pending/accepted/rejected/all)
- Date information

#### PositionRequests Page
Location: `src/pages/PositionRequests.jsx`

Full page for managing position requests:
- Accessible via `/position-requests` route
- Link in left sidebar: "Position Requests"

---

## Navigation

### Employee Navigation
1. **Sidebar** → "Position Requests"
   - Takes to `/position-requests` page
   - Shows all received position requests
   - Can accept or decline

2. **Notifications** → Position request notification
   - Directs to the position request details

### Company Owner Navigation
1. **Company Page**
   - "Position Requests" section visible to owner only
   - "Send Request" button opens modal
   - Can filter requests by status
   - Can see employee responses

---

## Database Schema

### position_requests Collection

```javascript
{
  "_id": ObjectId,
  "id": "unique_request_id",
  "company_id": "company_id",
  "employee_id": "user_id",
  "position": "Job Title",
  "department": "Department Name",
  "description": "Optional description",
  "status": "pending|accepted|rejected",
  "created_at": "ISO_DATE",
  "responded_at": "ISO_DATE|null"
}
```

### Indexes
- `(company_id, employee_id, status)` - Unique constraint to prevent duplicate pending requests
- `(employee_id, status, created_at)` - For employee's received requests query
- `(company_id, status, created_at)` - For company's sent requests query
- `(created_at)` - For sorting

---

## Usage Examples

### Example 1: Company Sends Position Request

**Frontend (JavaScript):**
```javascript
import { companiesApi } from '../api';

async function sendPositionRequest() {
  try {
    const response = await companiesApi.sendPositionRequest('company123', {
      employee_id: 'user456',
      position: 'Product Manager',
      department: 'Product',
      description: 'Lead product strategy for mobile app'
    });
    console.log('Request sent:', response);
  } catch (error) {
    console.error('Failed:', error);
  }
}
```

### Example 2: Employee Accepts Request

**Frontend (JavaScript):**
```javascript
import { companiesApi } from '../api';

async function acceptRequest(requestId) {
  try {
    const response = await companiesApi.acceptPositionRequest(requestId);
    console.log('Request accepted:', response);
    // Employee is now added to company
  } catch (error) {
    console.error('Failed:', error);
  }
}
```

### Example 3: Get All Pending Requests for Employee

**Frontend (JavaScript):**
```javascript
import { companiesApi } from '../api';

async function loadPendingRequests() {
  try {
    const requests = await companiesApi.getReceivedRequests('pending');
    console.log('Pending requests:', requests);
  } catch (error) {
    console.error('Failed:', error);
  }
}
```

---

## Notifications

The system automatically sends notifications for:

1. **Position Request Sent**
   - Sent to: Employee
   - Text: "invited you to join as [position] at [company]"
   - Type: `position_request`

2. **Position Request Accepted**
   - Sent to: Company Owner
   - Text: "accepted position request to join [company] as [position]"
   - Type: `position_accepted`

3. **Position Request Rejected**
   - Sent to: Company Owner
   - Text: "declined position request at [company]"
   - Type: `position_rejected`

---

## Security & Authorization

### Sending Position Requests
- ✅ Only company owner can send
- ✅ Admin can also send on behalf of company
- ✅ Cannot send to already-member employees
- ✅ Prevents duplicate pending requests to same employee

### Accepting/Rejecting Requests
- ✅ Only the targeted employee can respond
- ✅ Cannot respond to non-pending requests

### Viewing Requests
- ✅ Employees can see their received requests
- ✅ Company owners can see their sent requests
- ✅ No cross-company visibility

---

## Files Modified/Created

### Backend
- ✅ `app/models.py` - Added `EmployeePositionRequestIn` model
- ✅ `app/routes/professional.py` - Added position request endpoints
- ✅ `app/main.py` - Added position_requests router, indexes, and database initialization

### Frontend
- ✅ `src/api/index.js` - Added position request API methods
- ✅ `src/components/SendPositionRequestModal.jsx` - NEW
- ✅ `src/components/PositionRequestsList.jsx` - NEW
- ✅ `src/components/EmployeePositionRequests.jsx` - NEW
- ✅ `src/pages/Company.jsx` - Added PositionRequestsList component
- ✅ `src/pages/PositionRequests.jsx` - NEW
- ✅ `src/components/LeftSidebar.jsx` - Added link to Position Requests
- ✅ `src/App.js` - Added route and import

---

## Next Steps / Enhancements

Potential features to add in the future:
1. Batch position requests (invite multiple employees at once)
2. Position request templates
3. Automatic reminders for pending requests
4. Position verification (admin approval)
5. Role-based position levels (Junior, Senior, Lead, etc.)
6. Department management interface
7. Position request analytics
8. Email notifications for position requests

---

## Testing the Feature

### Test Scenario 1: Send Position Request
1. Log in as company owner
2. Go to company page
3. Scroll to "Position Requests" section
4. Click "Send Request"
5. Search for and select an employee
6. Enter position details
7. Click "Send Request"
8. ✅ Verify request appears in list with "pending" status

### Test Scenario 2: Accept Position Request
1. Log in as employee who received request
2. Go to `/position-requests` page (or click link in sidebar)
3. Find the position request
4. Click "Accept" button
5. ✅ Verify request status changes to "accepted"
6. ✅ Go to company page and verify employee is listed in "People" section

### Test Scenario 3: Reject Position Request
1. Log in as employee
2. Go to `/position-requests` page
3. Find pending request
4. Click "Decline" button
5. ✅ Verify request status changes to "rejected"

---

## Support

If you encounter any issues:
1. Check browser console for errors
2. Check backend logs for API errors
3. Verify user has proper permissions
4. Ensure company and employee exist in database
5. Check notification system is working
