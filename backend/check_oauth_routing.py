"""Check OAuth routing and configuration."""
import sys
from app.config import (
    GITHUB_OAUTH_REDIRECT,
    GOOGLE_OAUTH_REDIRECT,
    GITHUB_CLIENT_ID,
    GOOGLE_CLIENT_ID,
)

print("=" * 80)
print("🔍 OAUTH ROUTING VERIFICATION")
print("=" * 80)

print("\n📱 GITHUB OAUTH CONFIGURATION:")
print(f"  Redirect URI: {GITHUB_OAUTH_REDIRECT}")
print(f"  Expected: http://localhost:8000/api/auth/github/callback")
print(f"  Match: {'✓ YES' if GITHUB_OAUTH_REDIRECT == 'http://localhost:8000/api/auth/github/callback' else '✗ NO'}")

print("\n🔐 GOOGLE OAUTH CONFIGURATION:")
print(f"  Redirect URI: {GOOGLE_OAUTH_REDIRECT}")
print(f"  Expected: http://localhost:8000/api/auth/google/callback")
print(f"  Match: {'✓ YES' if GOOGLE_OAUTH_REDIRECT == 'http://localhost:8000/api/auth/google/callback' else '✗ NO'}")

print("\n" + "=" * 80)
print("⚠️  CRITICAL CHECK:")
print("=" * 80)

issues = []

# Check if GitHub redirect is pointing to Google endpoint
if GITHUB_OAUTH_REDIRECT and 'google' in GITHUB_OAUTH_REDIRECT.lower():
    issues.append("🔴 GITHUB_OAUTH_REDIRECT contains 'google' - WRONG!")
    
if GOOGLE_OAUTH_REDIRECT and 'github' in GOOGLE_OAUTH_REDIRECT.lower():
    issues.append("🔴 GOOGLE_OAUTH_REDIRECT contains 'github' - WRONG!")

# Check if they're the same
if GITHUB_OAUTH_REDIRECT and GOOGLE_OAUTH_REDIRECT:
    if GITHUB_OAUTH_REDIRECT == GOOGLE_OAUTH_REDIRECT:
        issues.append("🔴 Both redirect URIs are IDENTICAL - MUST BE DIFFERENT!")

# Check for /github/callback
if GITHUB_OAUTH_REDIRECT and '/github/callback' not in GITHUB_OAUTH_REDIRECT:
    issues.append(f"🔴 GITHUB_OAUTH_REDIRECT missing '/github/callback'")
    issues.append(f"   Current: {GITHUB_OAUTH_REDIRECT}")
    issues.append(f"   Should be: http://localhost:8000/api/auth/github/callback")

# Check for /google/callback
if GOOGLE_OAUTH_REDIRECT and '/google/callback' not in GOOGLE_OAUTH_REDIRECT:
    issues.append(f"🔴 GOOGLE_OAUTH_REDIRECT missing '/google/callback'")
    issues.append(f"   Current: {GOOGLE_OAUTH_REDIRECT}")
    issues.append(f"   Should be: http://localhost:8000/api/auth/google/callback")

if issues:
    print("\n❌ PROBLEMS FOUND:")
    for issue in issues:
        print(f"  {issue}")
    print("\n💡 SOLUTION:")
    print("   Update backend/.env to have:")
    print('   GITHUB_OAUTH_REDIRECT="http://localhost:8000/api/auth/github/callback"')
    print('   GOOGLE_OAUTH_REDIRECT="http://localhost:8000/api/auth/google/callback"')
    sys.exit(1)
else:
    print("\n✅ All OAuth redirects are configured correctly!")
    print("\n🔗 IMPORTANT:")
    print("   Make sure GitHub OAuth app has registered redirect URI:")
    print(f"   → {GITHUB_OAUTH_REDIRECT}")
    print("\n   Make sure Google OAuth app has registered redirect URI:")
    print(f"   → {GOOGLE_OAUTH_REDIRECT}")
    
print("\n" + "=" * 80)
