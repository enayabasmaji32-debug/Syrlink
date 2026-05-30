"""Check OAuth environment variables."""
import os

print("=" * 60)
print("🔍 OAUTH CONFIGURATION CHECK")
print("=" * 60)

print("\n📱 GitHub OAuth:")
github_id = os.getenv("GITHUB_CLIENT_ID")
github_secret = os.getenv("GITHUB_CLIENT_SECRET")
github_redirect = os.getenv("GITHUB_OAUTH_REDIRECT", "")
print(f"  GITHUB_CLIENT_ID: {'✓ SET' if github_id else '✗ MISSING'} ({len(github_id) if github_id else 0} chars)")
print(f"  GITHUB_CLIENT_SECRET: {'✓ SET' if github_secret else '✗ MISSING'} ({len(github_secret) if github_secret else 0} chars)")
print(f"  GITHUB_OAUTH_REDIRECT: {'✓ SET' if github_redirect else '✗ MISSING'}")
print(f"    → {github_redirect if github_redirect else '(empty)'}")

print("\n🔐 Google OAuth:")
google_id1 = os.getenv("GOOGLECLIENTID")
google_id2 = os.getenv("GOOGLE_CLIENT_ID")
google_id = google_id1 or google_id2
google_secret1 = os.getenv("GOOGLECLIENTSECRET")
google_secret2 = os.getenv("GOOGLE_CLIENT_SECRET")
google_secret = google_secret1 or google_secret2
google_redirect1 = os.getenv("GOOGLEREDIRECTURI", "")
google_redirect2 = os.getenv("GOOGLE_OAUTH_REDIRECT", "")
google_redirect = google_redirect1 or google_redirect2

print(f"  GOOGLE_CLIENT_ID: {'✓ SET' if google_id else '✗ MISSING'} ({len(google_id) if google_id else 0} chars)")
print(f"    Sources: GOOGLECLIENTID={bool(google_id1)} or GOOGLE_CLIENT_ID={bool(google_id2)}")
print(f"  GOOGLE_CLIENT_SECRET: {'✓ SET' if google_secret else '✗ MISSING'} ({len(google_secret) if google_secret else 0} chars)")
print(f"    Sources: GOOGLECLIENTSECRET={bool(google_secret1)} or GOOGLE_CLIENT_SECRET={bool(google_secret2)}")
print(f"  GOOGLE_OAUTH_REDIRECT: {'✓ SET' if google_redirect else '✗ MISSING'}")
print(f"    → {google_redirect if google_redirect else '(empty) ← ⚠️  THIS IS LIKELY THE PROBLEM'}")

print("\n🌐 App URL:")
app_url = os.getenv("APP_URL", "")
print(f"  APP_URL: {'✓ SET' if app_url else '✗ MISSING'}")
print(f"    → {app_url if app_url else '(empty)'}")

print("\n" + "=" * 60)
if not google_redirect:
    print("❌ GOOGLE_OAUTH_REDIRECT is EMPTY!")
    print("   This will cause 400 errors when exchanging OAuth code")
    print("\n✅ SOLUTION:")
    print("   Set GOOGLE_OAUTH_REDIRECT or GOOGLEREDIRECTURI")
    print("   Example: http://localhost:8000/api/auth/google/callback")
    print("           or https://yourdomain.com/api/auth/google/callback")
else:
    print(f"✓ GOOGLE_OAUTH_REDIRECT is set: {google_redirect}")
print("=" * 60)
