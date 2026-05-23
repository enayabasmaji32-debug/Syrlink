# SyrLink — Bug Fix Session

## Original Problem (User report, Arabic)
> فك ضغط الملف فيو كتير اخطاء، البوست عم يطول لينتشر، وصلح الصورة الملف الشخصي عم تكون مقصوصة لانو متصلة مباشر مع صورة الغلاف فقط، وشوف ازا في كم خطاء صلحو

Translation: Unzip the file, there are many errors. Posts take a long time to publish, fix the profile picture being cropped because it's directly connected only to the cover photo, and check if there are more bugs to fix.

## Root Causes Identified

### 1. Posts taking forever to publish ("جاري النشر")
- `EditProfile.jsx` was using `FileReader.readAsDataURL` to convert the user's chosen avatar/cover image into a **base64 data URL** and storing it directly in MongoDB. A typical 3 MB photo became a ~4 MB string per field (cover + avatar = up to 8 MB stored on the user document).
- The auth dependency `get_current_user` ran on **every** authenticated request and called `db.users.find_one(...)` with a broad projection — pulling the entire (now huge) user doc from MongoDB Atlas (a remote cluster).
- Each POST `/api/posts` therefore had to wait for several megabytes to travel from Atlas → backend → before the post itself was inserted. Net effect: 10–30 second hangs at "Posting…".

### 2. Profile picture appearing cropped / "connected to cover"
- Same root cause: base64 stored directly with no aspect-ratio handling. The rectangular base64 image was forced into a circle via `object-cover` on top of the cover photo, making the avatar look squished/cropped.
- The Edit Profile preview was also too small (h-20 w-20) and didn't reflect the real Profile page rendering, so users couldn't tell what they were going to get.

## Fixes Applied

### Backend
- `backend/app/security.py` — `get_current_user` now uses a **slim projection** that excludes `cover`, `about`, `experience`, `education`, `verify_token`, `reset_token`, `reset_token_at`. These are not needed for auth checks. This single change makes every authenticated endpoint (incl. POST /posts) fast, even for legacy users who still have base64 stored in MongoDB.
- `backend/app/routes/auth.py` — `/auth/me` now re-fetches the full user document so the UI still receives `cover`, `about`, `experience`, `education` for profile rendering.
- `backend/app/routes/posts.py` — fixed a minor lint issue (loop variable shadowing the imported `uid` function).
- `backend/app/routes/professional.py` — removed an unused f-string prefix.

### Frontend
- `frontend/src/pages/EditProfile.jsx`
  - Replaced `FileReader.readAsDataURL` with `uploadApi.uploadFile` → images now upload to **Cloudinary** and only a short HTTPS URL is stored in MongoDB.
  - Added independent loading states for avatar and cover (`uploadingAvatar`, `uploadingCover`).
  - Save button is disabled while either upload is in progress.
  - Added a 10 MB client-side size guard.
  - Avatar preview enlarged to 96×96 round (`object-cover object-center`) and made visually consistent with the actual Profile page.
  - Added explicit copy: "Square images work best. Your profile picture is uploaded independently of the cover photo." — makes it clear the two are not coupled.
  - Added `data-testid` attributes for all upload inputs / save button.
- `frontend/src/pages/Profile.jsx` — avatar gets `object-center` and a soft shadow; added `data-testid="profile-avatar"`.
- `frontend/.env` — `REACT_APP_BACKEND_URL` set to the preview URL so the app runs end-to-end in the Emergent preview environment.

## Verified
- Logged in as `admin@syrlink.com / Admin@SyrLink2026` — login OK.
- POST `/api/posts` measured at **0.97 s** (UI → success toast → modal closed) via Playwright.
- POST `/api/posts` measured at **0.91 s** even after artificially planting a 2 MB base64 cover in the same user's DB record (proves the slim projection mitigates legacy bad data).
- `/auth/me` still returns full user doc (cover, about, experience, education present).
- Edit Profile page renders two independent file inputs; avatar preview is round and 96×96.
- Profile page avatar is round, 144×144, properly centred — not visibly "cropped onto cover" anymore.

## Backlog / future improvements
- (P1) Backend one-shot migration script to convert any existing base64 `avatar`/`cover` strings into Cloudinary URLs.
- (P2) Cloudinary transformation (`c_fill,g_face,w_400,h_400`) on the returned `secure_url` to auto-crop avatars around the face.
- (P2) Image cropper UI before upload (react-easy-crop) for users who want manual control.

## Smart enhancement suggestion
> Why don't you add an upload-time **Cloudinary face-auto-crop** transformation so every profile picture is centred on the user's face automatically? It's literally one URL parameter (`c_fill,g_face`) and it removes 90% of the "my photo looks cropped" complaints — great UX win for free.
