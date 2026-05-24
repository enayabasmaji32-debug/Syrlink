# Build frontend assets
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Build backend image
FROM python:3.14-slim
WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN python -m pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source and frontend build output
COPY backend/ ./backend/
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Expose backend port
EXPOSE 8000

# Run the FastAPI app (use Railway PORT if available)
WORKDIR /app/backend
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
