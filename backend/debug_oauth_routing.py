"""Debug OAuth routing - trace which endpoints are being called."""
import asyncio
from app.database import db
from app.config import (
    GITHUB_OAUTH_REDIRECT,
    GOOGLE_OAUTH_REDIRECT,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
)

print("=" * 70)
print("🔍 OAUTH ROUTING DEBUG")
print("=" * 70)

print("\n📱 GITHUB OAUTH CONFIGURATION:")
print(f"  Client ID: {'✓' if GITHUB_CLIENT_ID else '✗'} {GITHUB_CLIENT_ID[:20] + '...' if GITHUB_CLIENT_ID else '(missing)'}")
print(f"  Client Secret: {'✓' if GITHUB_CLIENT_SECRET else '✗'} {GITHUB_CLIENT_SECRET[:10] + '...' if GITHUB_CLIENT_SECRET else '(missing)'}")
print(f"  Redirect URI: {GITHUB_OAUTH_REDIRECT}")
print(f"  → Endpoint: /api/auth/github/login")
print(f"  → Callback: /api/auth/github/callback")
print(f"  → Token Exchange: https://github.com/login/oauth/access_token")

print("\n🔐 GOOGLE OAUTH CONFIGURATION:")
print(f"  Client ID: {'✓' if GOOGLE_CLIENT_ID else '✗'} {GOOGLE_CLIENT_ID[:20] + '...' if GOOGLE_CLIENT_ID else '(missing)'}")
print(f"  Client Secret: {'✓' if GOOGLE_CLIENT_SECRET else '✗'} {GOOGLE_CLIENT_SECRET[:10] + '...' if GOOGLE_CLIENT_SECRET else '(missing)'}")
print(f"  Redirect URI: {GOOGLE_OAUTH_REDIRECT}")
print(f"  → Endpoint: /api/auth/google/login")
print(f"  → Callback: /api/auth/google/callback")
print(f"  → Token Exchange: https://oauth2.googleapis.com/token")

print("\n" + "=" * 70)
print("✅ VERIFICATION CHECKLIST:")
print("=" * 70)

issues = []

if not GITHUB_CLIENT_ID:
    issues.append("❌ GITHUB_CLIENT_ID is missing!")
if not GITHUB_CLIENT_SECRET:
    issues.append("❌ GITHUB_CLIENT_SECRET is missing!")
if not GOOGLE_CLIENT_ID:
    issues.append("❌ GOOGLE_CLIENT_ID is missing!")
if not GOOGLE_CLIENT_SECRET:
    issues.append("❌ GOOGLE_CLIENT_SECRET is missing!")

if not GITHUB_OAUTH_REDIRECT:
    issues.append("❌ GITHUB_OAUTH_REDIRECT is empty!")
elif "github" not in GITHUB_OAUTH_REDIRECT.lower():
    issues.append("⚠️  GITHUB_OAUTH_REDIRECT doesn't contain 'github' - might be wrong!")

if not GOOGLE_OAUTH_REDIRECT:
    issues.append("❌ GOOGLE_OAUTH_REDIRECT is empty!")
elif "google" not in GOOGLE_OAUTH_REDIRECT.lower():
    issues.append("⚠️  GOOGLE_OAUTH_REDIRECT doesn't contain 'google' - might be wrong!")

if issues:
    print("\n❌ PROBLEMS FOUND:")
    for issue in issues:
        print(f"  {issue}")
else:
    print("✅ All OAuth configurations look correct!")

print("\n" + "=" * 70)
print("🔗 IMPORTANT: Make sure these redirect URIs match in OAuth provider settings!")
print("=" * 70)
