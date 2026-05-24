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

# Resend
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM = os.environ.get("RESEND_FROM", "onboarding@resend.dev")

# App
APP_URL = os.environ.get("APP_URL", "")
CORS_ORIGINS = [origin.strip() for origin in os.environ.get("CORS_ORIGINS", "*").split(",")]

# OAuth / cookie settings
JWT_COOKIE_NAME = os.environ.get("JWT_COOKIE_NAME", "li_token")
JWT_COOKIE_MAX_AGE = int(os.environ.get("JWT_COOKIE_MAX_AGE", "604800"))  # 7 days
COOKIE_SECURE = APP_URL.startswith("https://")
GOOGLE_CLIENT_ID = os.getenv("GOOGLECLIENTID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLECLIENTSECRET")
GOOGLE_OAUTH_REDIRECT = os.getenv("GOOGLEREDIRECTURI", "")

# Admin defaults
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@syrlink.com").lower()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@SyrLink2026")
