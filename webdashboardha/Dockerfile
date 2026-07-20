# --- Stufe 1: Frontend bauen (Node) ---
FROM node:20-alpine AS frontend-build
WORKDIR /build/frontend
# Nur Manifeste zuerst → npm-Layer wird gecacht, solange sich Deps nicht ändern.
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build
# Ergebnis: /build/frontend/dist

# --- Stufe 2: Python-Runtime ---
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    STATIC_DIR=/app/static \
    DATA_DIR=/data \
    PORT=8099

WORKDIR /app/backend

# Backend-Deps
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Backend-Code
COPY backend/app ./app

# Gebautes Frontend aus Stufe 1
COPY --from=frontend-build /build/frontend/dist /app/static

EXPOSE 8099

# uvicorn direkt (kein bashio nötig — SUPERVISOR_TOKEN kommt aus der Umgebung).
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8099"]
