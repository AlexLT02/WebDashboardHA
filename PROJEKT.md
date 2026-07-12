# WebDashboardHA

Steuerbares, editierbares Web-Dashboard für Home Assistant — läuft als HA-Add-on,
primäres Bediengerät ist ein **iPad Air 1 (2013, Safari 12)** im Vollbild-Kiosk.

## Stack
- **Frontend:** React + TypeScript (Vite, `@vitejs/plugin-legacy` für Safari 12)
- **Backend:** Python FastAPI (uvicorn), proxyt Home Assistant über `SUPERVISOR_TOKEN`
- **Deployment:** Docker-Add-on für HA OS (Ingress + eigener Kiosk-Port 8099)

## Architektur (Kurzfassung)
```
iPad (Safari 12 / PWA-Kiosk)
   │  WebSocket (nur geänderte States)
   ▼
FastAPI-Add-on ── SUPERVISOR_TOKEN ──> HA Core (subscribe state_changed, call_service)
   ├─ GET  /                statisches React-SPA
   ├─ REST /api/dashboards  CRUD Layout-JSON (/data)
   ├─ REST /api/service     call_service Proxy
   └─ WS   /ws              Live-States (fan-out an alle Clients)
```

## iPad Air 1 / Safari 12 — harte Regeln
1. Legacy-Build zwingend (`plugin-legacy`, browserslist `iOS >= 12`, `Safari >= 12`).
2. Kein `gap` in Flexbox (erst Safari 14.1) → CSS-Grid-`gap` oder Margins.
3. `<input type=color>` unbrauchbar → eigenes SVG-Farbrad.
4. `<input type=range>` unzuverlässig → eigener Touch-Slider.
5. Bundle < 2 MB brotli, RAM ~1 GB, keine Idle-Animationen.
6. State fließt Backend→iPad (eine HA-Subscription, kleine Payloads).

## Struktur
```
frontend/   React + Vite (+ plugin-legacy)
backend/    FastAPI (HA-Client, Fan-out-Hub, Dashboard-Storage)
ha-addon/   config.yaml + Multi-Stage-Dockerfile + run.sh
tests/      Vitest/RTL + Playwright (iPad-Viewport)
```

## Entwicklung
```bash
# Frontend (Dev)
cd frontend && npm install && npm run dev

# Backend (Dev) — HA-Zugriff via .env HA_URL + HA_TOKEN (lokal statt Supervisor)
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload

# Production-Build Frontend
cd frontend && npm run build   # → frontend/dist, wird vom Backend statisch serviert
```

## Verifikations-Meilensteine
- **M1:** Legacy-Bundle < 2 MB, Add-on startet, LightCard schaltet echtes Licht,
  Live-Update über `/ws`.
- **M2:** HA-Reconnect + Fan-out an mehrere Clients.
- **M3:** echtes iPad Air 1 (30 min: Start, Load < 3 s, Slider/Farbrad flüssig,
  PWA-Vollbild ohne URL-Leiste). **Hartes Gate.**
- **M4:** Dark-Mode, Landscape/Portrait, Design-Audit.
