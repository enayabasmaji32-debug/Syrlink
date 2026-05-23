# SyrLink — Test Credentials

## Admin (seeded automatically on backend startup)
- Email: `admin@syrlink.com`
- Password: `Admin@SyrLink2026`

## Demo user (from seed)
- Email: `demo@syrlink.com`
- Password: `demo1234`

## Notes
- Both accounts are auto-created on backend startup if missing (see `app/main.py` startup hook and `seed.py`).
- The admin user is force-set to `is_admin=True` and `verified=True` on every startup.
