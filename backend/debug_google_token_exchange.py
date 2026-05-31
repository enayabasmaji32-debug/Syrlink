"""Debug Google OAuth token exchange to see what's being sent."""
import asyncio
import httpx
from app.config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT

async def test_token_exchange():
    """Simulate what happens when Google returns a code."""
    
    print("=" * 80)
    print("🔍 GOOGLE OAUTH TOKEN EXCHANGE DEBUG")
    print("=" * 80)
    
    # Simulated values (these would come from Google in real flow)
    test_code = "4/0AXAz7da-test-code-only"  # Won't work, just testing request
    test_redirect_uri = GOOGLE_OAUTH_REDIRECT
    
    print(f"\n📤 WHAT WE'RE SENDING TO GOOGLE:")
    print(f"  Endpoint: https://oauth2.googleapis.com/token")
    print(f"  Method: POST")
    print(f"  Params:")
    print(f"    • code: {test_code}")
    print(f"    • client_id: {GOOGLE_CLIENT_ID[:30] if GOOGLE_CLIENT_ID else '(MISSING)'}...")
    print(f"    • client_secret: {GOOGLE_CLIENT_SECRET[:30] if GOOGLE_CLIENT_SECRET else '(MISSING)'}...")
    print(f"    • redirect_uri: {test_redirect_uri}")
    print(f"    • grant_type: authorization_code")
    
    # Check for placeholders
    print(f"\n🔍 VALIDATION:")
    if not GOOGLE_CLIENT_ID or GOOGLE_CLIENT_ID.startswith("["):
        print(f"  ❌ GOOGLE_CLIENT_ID is MISSING or PLACEHOLDER")
        print(f"     Current: {GOOGLE_CLIENT_ID}")
        print(f"     Expected: Real Client ID from Google Console")
        
    if not GOOGLE_CLIENT_SECRET or GOOGLE_CLIENT_SECRET.startswith("["):
        print(f"  ❌ GOOGLE_CLIENT_SECRET is MISSING or PLACEHOLDER")
        print(f"     Current: {GOOGLE_CLIENT_SECRET}")
        print(f"     Expected: Real Client Secret from Google Console")
        
    if not GOOGLE_OAUTH_REDIRECT:
        print(f"  ❌ GOOGLE_OAUTH_REDIRECT is EMPTY")
    else:
        print(f"  ✓ GOOGLE_OAUTH_REDIRECT: {GOOGLE_OAUTH_REDIRECT}")
    
    print(f"\n" + "=" * 80)
    print("⚠️  WHY 400 ERROR HAPPENS:")
    print("=" * 80)
    print("""
    Google returns 400 (Bad Request) when:
    
    1. ❌ client_id is wrong/placeholder → "invalid_client"
    2. ❌ client_secret is wrong/placeholder → "invalid_client"  
    3. ❌ code is invalid/expired → "invalid_grant"
    4. ❌ redirect_uri doesn't match → "redirect_uri_mismatch"
    5. ❌ grant_type missing → malformed request
    
    CURRENT STATUS:
    """)
    
    issues = []
    if not GOOGLE_CLIENT_ID or GOOGLE_CLIENT_ID.startswith("["):
        issues.append("❌ GOOGLE_CLIENT_ID is PLACEHOLDER/MISSING")
    if not GOOGLE_CLIENT_SECRET or GOOGLE_CLIENT_SECRET.startswith("["):
        issues.append("❌ GOOGLE_CLIENT_SECRET is PLACEHOLDER/MISSING")
    if not GOOGLE_OAUTH_REDIRECT:
        issues.append("❌ GOOGLE_OAUTH_REDIRECT is EMPTY")
        
    if issues:
        print("\n    PROBLEMS FOUND:")
        for issue in issues:
            print(f"    {issue}")
        print("\n    🔴 CANNOT COMPLETE OAUTH WITHOUT REAL CREDENTIALS!")
    else:
        print("\n    ✓ All credentials look valid")
    
    print("\n" + "=" * 80)
    print("📋 HOW TO FIX:")
    print("=" * 80)
    print("""
    1. Go to https://console.cloud.google.com
    2. Select your project
    3. APIs & Services → Credentials
    4. Click on OAuth 2.0 Client ID (Web application)
    5. Copy: Client ID and Client Secret
    6. Update backend/.env:
       GOOGLECLIENTID="your-real-client-id"
       GOOGLECLIENTSECRET="your-real-client-secret"
    7. Restart server: Ctrl+C then py server.py
    8. Try again
    """)
    
    print("\n" + "=" * 80)

if __name__ == "__main__":
    asyncio.run(test_token_exchange())
