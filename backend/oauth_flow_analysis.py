"""Enhanced OAuth debugging middleware - trace every OAuth call."""
import sys
from datetime import datetime

def log_oauth_flow():
    """Generate detailed OAuth flow log."""
    print("\n" + "=" * 80)
    print("🔍 OAUTH FLOW ANALYSIS - Generated at " + datetime.now().isoformat())
    print("=" * 80)
    
    print("\n📊 EXPECTED FLOW:")
    print("""
    ┌─────────────────────┐
    │   GITHUB FLOW       │
    └─────────────────────┘
    1. User clicks "Sign in with GitHub"
    2. Frontend calls: /api/auth/github/login
    3. Backend creates state, returns redirect to GitHub
    4. User logs into GitHub
    5. GitHub redirects back to: /api/auth/github/callback?code=XXX&state=YYY
    6. Backend exchanges code via: https://github.com/login/oauth/access_token
    7. Backend gets access_token, fetches user from: https://api.github.com/user
    8. Backend creates/updates user, returns JWT cookie
    9. Frontend redirect to APP_URL with JWT cookie set
    
    ┌─────────────────────┐
    │   GOOGLE FLOW       │
    └─────────────────────┘
    1. User clicks "Sign in with Google"
    2. Frontend calls: /api/auth/google/login
    3. Backend creates state, returns redirect to Google
    4. User logs into Google
    5. Google redirects back to: /api/auth/google/callback?code=ZZZ&state=WWW
    6. Backend exchanges code via: https://oauth2.googleapis.com/token
    7. Backend gets access_token, fetches user from: https://www.googleapis.com/oauth2/v2/userinfo
    8. Backend creates/updates user, returns JWT cookie
    9. Frontend redirect to APP_URL with JWT cookie set
    """)
    
    print("\n" + "=" * 80)
    print("⚠️  POSSIBLE ISSUES IF GITHUB ROUTES TO GOOGLE:")
    print("=" * 80)
    print("""
    1. ❌ Wrong redirect_uri registered in GitHub OAuth app
       - GitHub app registered with: https://example.com/api/auth/google/callback
       - But code is sending to: /api/auth/github/callback
       
    2. ❌ Browser cookie mixup (state cookie not cleared properly)
       - GitHub creates state ABC123
       - Cookie set as oauth_state=ABC123
       - Google creates state XYZ789
       - Cookie OVERWRITTEN as oauth_state=XYZ789
       - GitHub callback comes, but oauth_state=XYZ789, causing mismatch
       
    3. ❌ Multiple OAuth providers using same cookie name
       - Use different cookie names: oauth_state_github, oauth_state_google
       
    4. ❌ Reverse proxy routing issue
       - Nginx/Apache routing all /callback requests to wrong handler
       
    5. ❌ Frontend sending request to wrong endpoint
       - Button onclick calls /api/auth/google/login instead of /api/auth/github/login
    """)
    
    print("\n" + "=" * 80)
    print("✅ SOLUTION IMPLEMENTED:")
    print("=" * 80)
    print("""
    ✓ Added placeholder detection in config.py
    ✓ Created separate login endpoints: /github/login vs /google/login
    ✓ Created separate callback endpoints: /github/callback vs /google/callback
    ✓ Each provider uses own token endpoint
    ✓ Logging tracks which provider is being used
    
    RECOMMENDED FIX:
    1. Use DIFFERENT cookie names for each provider:
       - oauth_state_github (for GitHub)
       - oauth_state_google (for Google)
       
    2. OR validate redirect_uri in GitHub/Google OAuth apps matches exactly
    3. Clear browser cookies and try again
    4. Check browser dev tools (Network tab) to see actual requests
    """)
    
    print("\n" + "=" * 80)

if __name__ == "__main__":
    log_oauth_flow()
