"""SyrLink Backend — FastAPI + MongoDB.

DEPRECATED: This shim now delegates to app/main.py.
Use `python -m uvicorn app.main:app` or the modular backend entrypoint.
"""
from app.main import app

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)
