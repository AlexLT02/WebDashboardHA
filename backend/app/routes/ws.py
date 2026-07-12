"""WebSocket-Route /ws: Live-States an die Frontend-Clients (fan-out)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

log = logging.getLogger("webdashboardha.ws")

router = APIRouter()


@router.websocket("/ws")
async def dashboard_ws(ws: WebSocket) -> None:
    hub = ws.app.state.hub
    await hub.connect_client(ws)
    try:
        while True:
            # Wir erwarten keine Kommandos über diesen Kanal (Steuerung läuft über
            # REST /api/service). receive_text hält die Verbindung offen und
            # erkennt das Trennen zuverlässig.
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001
        log.debug("WS-Fehler: %s", exc)
    finally:
        await hub.disconnect_client(ws)
