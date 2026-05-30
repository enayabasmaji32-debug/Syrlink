"""Configuration and environment setup."""
import os
import logging
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("syrlink")

# Environment variables
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_MIN = int(os.environ.get("JWT_EXPIRY_MIN", "10080"))

# Cloudinary
CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.environ.get("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET", "")

# App
APP_URL = os.environ.get("APP_URL", "")
# CORS: do not default to open wildcard in production. If CORS_ORIGINS is not set,
# restrict to localhost for development. In production, require explicit config.
raw_cors = os.environ.get("CORS_ORIGINS")
if raw_cors:
	CORS_ORIGINS = [origin.strip() for origin in raw_cors.split(",") if origin.strip()]
else:
	# default to localhost in dev to avoid open CORS
	if os.environ.get("ENV", "dev").lower() == "production":
		raise RuntimeError("CORS_ORIGINS must be set in production environment")
	CORS_ORIGINS = ["http://localhost:3000"]

# Redis (optional) for OTP/session storage
REDIS_URL = os.environ.get("REDIS_URL", "")

# OAuth / cookie settings
JWT_COOKIE_NAME = os.environ.get("JWT_COOKIE_NAME", "li_token")
JWT_COOKIE_MAX_AGE = int(os.environ.get("JWT_COOKIE_MAX_AGE", "604800"))  # 7 days
COOKIE_SECURE = APP_URL.startswith("https://")

# GitHub OAuth
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "").strip()
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "").strip()
GITHUB_OAUTH_REDIRECT = os.getenv("GITHUB_OAUTH_REDIRECT", "").strip()

# Validate GitHub OAuth
if GITHUB_CLIENT_ID and GITHUB_CLIENT_ID.startswith("["):
    log.warning("⚠️  GITHUB_CLIENT_ID appears to be a placeholder, disabling GitHub OAuth")
    GITHUB_CLIENT_ID = ""
if GITHUB_CLIENT_SECRET and GITHUB_CLIENT_SECRET.startswith("["):
    log.warning("⚠️  GITHUB_CLIENT_SECRET appears to be a placeholder, disabling GitHub OAuth")
    GITHUB_CLIENT_SECRET = ""

# Google OAuth
GOOGLE_CLIENT_ID = (os.getenv("GOOGLECLIENTID") or os.getenv("GOOGLE_CLIENT_ID") or "").strip()
GOOGLE_CLIENT_SECRET = (os.getenv("GOOGLECLIENTSECRET") or os.getenv("GOOGLE_CLIENT_SECRET") or "").strip()
GOOGLE_OAUTH_REDIRECT = (os.getenv("GOOGLEREDIRECTURI") or os.getenv("GOOGLE_OAUTH_REDIRECT") or "").strip()

# Validate Google OAuth
if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID.startswith("["):
    log.warning("⚠️  GOOGLE_CLIENT_ID appears to be a placeholder, disabling Google OAuth")
    GOOGLE_CLIENT_ID = ""
if GOOGLE_CLIENT_SECRET and GOOGLE_CLIENT_SECRET.startswith("["):
    log.warning("⚠️  GOOGLE_CLIENT_SECRET appears to be a placeholder, disabling Google OAuth")
    GOOGLE_CLIENT_SECRET = ""

# Admin defaults
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "basmajienaya@gmail.com").lower()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@SyrLink2026")
