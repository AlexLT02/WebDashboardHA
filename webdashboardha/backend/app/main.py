"""FastAPI-Einstiegspunkt für das WebDashboardHA-Add-on.

Verdrahtet HA-Client/Hub (Live-States + Steuerung), Dashboard-Storage und das
statische Ausliefern des gebauten Frontends.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import load_settings
from .hub import Hub
from .routes import control, dashboards, ws
from .storage import DashboardStore

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("webdashboardha")

settings = load_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("WebDashboardHA startet — HA-Basis: %s", settings.ha_base_url)
    log.info("Static-Dir: %s (existiert: %s)", settings.static_dir, settings.static_dir.exists())

    store = DashboardStore(settings.data_dir)
    store.init()
    app.state.store = store

    hub = Hub(settings)
    app.state.hub = hub
    hub.start()

    try:
        yield
    finally:
        log.info("WebDashboardHA fährt herunter.")
        await hub.stop()


app = FastAPI(title="WebDashboardHA", lifespan=lifespan)

# API-/WS-Router VOR dem Static-Mount registrieren.
app.include_router(control.router)
app.include_router(dashboards.router)
app.include_router(ws.router)


@app.get("/api/health")
async def health() -> JSONResponse:
    hub = getattr(app.state, "hub", None)
    return JSONResponse(
        {
            "status": "ok",
            "ha_configured": bool(settings.ha_token),
            "ha_connected": bool(hub and hub.ha_connected),
            "ha_base_url": settings.ha_base_url,
        }
    )


def _mount_frontend() -> None:
    """Serviert das gebaute SPA unter "/". Muss NACH allen /api- und /ws-Routen
    registriert werden, damit diese nicht vom Catch-all geschluckt werden."""
    static_dir = settings.static_dir
    if not static_dir.exists():
        log.warning(
            "Frontend-Build fehlt unter %s — erst `npm run build` im frontend/ laufen lassen.",
            static_dir,
        )

        @app.get("/")
        async def _no_build() -> JSONResponse:
            return JSONResponse(
                {"error": "Frontend nicht gebaut", "expected": str(static_dir)},
                status_code=503,
            )

        return

    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="spa")


_mount_frontend()
