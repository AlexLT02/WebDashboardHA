"""Real backend on the fixture snapshot, for UI acceptance runs without HA.

    cd backend && .venv/Scripts/python tests/fixture_server.py --port 8199 --data <dir>

Serves the built frontend (frontend/dist, the Legacy bundle) plus the real
/api and /ws routes. The HA side is the FakeHA from conftest: registry and
states come from tests/fixtures, service calls are only recorded
(GET /__fixture/calls). /data lives in <dir>, so stopping and starting the
process is a real backend restart (zones.json survives).
Test tool only: never part of the add-on image.
"""

from __future__ import annotations

import argparse
import sys
from contextlib import asynccontextmanager
from dataclasses import replace
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))

import uvicorn  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

from app.config import load_settings  # noqa: E402
from app.hub import Hub  # noqa: E402
from app.routes import board, control, dashboards, ws  # noqa: E402
from app.storage import DashboardStore  # noqa: E402
from app.zones import ZoneStore, load_seed  # noqa: E402
from conftest import FakeHA, load_registry_lists, load_states  # noqa: E402

DIST = HERE.parents[1] / "frontend" / "dist"


def make_app(data_dir: Path, static_dir: Path) -> FastAPI:
    settings = replace(load_settings(), data_dir=data_dir, ha_token="fixture", static_dir=static_dir)
    store = DashboardStore(data_dir)
    store.init()
    zones = ZoneStore(data_dir / "zones.json", load_seed())
    hub = Hub(settings, dashboards=store, zones=zones, ha_factory=FakeHA)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        hub.zones.load()
        await hub.ha.connect(load_registry_lists(), load_states())
        yield
        await hub.stop()

    app = FastAPI(lifespan=lifespan)
    app.state.store = store
    app.state.hub = hub
    for r in (control.router, dashboards.router, board.router, ws.router):
        app.include_router(r)

    @app.get("/__fixture/calls")
    async def fixture_calls() -> list[dict]:
        return [
            {"domain": d, "service": s, "entity_id": e, "data": data}
            for d, s, e, data in hub.ha.calls
        ]

    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="spa")
    return app


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8199)
    ap.add_argument("--data", type=Path, required=True)
    ap.add_argument("--static", type=Path, default=DIST)
    args = ap.parse_args()
    args.data.mkdir(parents=True, exist_ok=True)
    uvicorn.run(make_app(args.data, args.static), host="127.0.0.1", port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
