"""State-Hub: hält den einen HA-Client, cached alle Entity-States und fächert
Änderungen an alle verbundenen Frontend-WebSockets aus.

Design: Nur EINE HA-Subscription für beliebig viele iPads. Neue Clients bekommen
sofort einen Snapshot, danach nur noch Deltas. Das schont die alte Hardware und
hält HA-seitig die Verbindungszahl minimal.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import WebSocket

from .config import Settings
from .ha_client import HAClient

log = logging.getLogger("webdashboardha.hub")


class Hub:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._states: dict[str, dict[str, Any]] = {}
        self._clients: set[WebSocket] = set()
        self._lock = asyncio.Lock()
        self.ha = HAClient(
            settings.ha_ws_url,
            settings.ha_token,
            on_state_change=self._on_state_change,
            on_connected=self._on_connected,
        )

    # ---- Lebenszyklus -----------------------------------------------------

    def start(self) -> None:
        self.ha.start()

    async def stop(self) -> None:
        await self.ha.stop()

    @property
    def ha_connected(self) -> bool:
        return self.ha.connected

    def snapshot(self) -> dict[str, dict[str, Any]]:
        return dict(self._states)

    # ---- HA-Callbacks -----------------------------------------------------

    async def _on_connected(self, snapshot: dict[str, dict[str, Any]]) -> None:
        """(Re-)Verbindung zu HA: kompletten State-Cache ersetzen und Clients
        einen frischen Snapshot schicken (falls sie eine HA-Downtime überlebt haben)."""
        self._states = snapshot
        log.info("HA-Snapshot: %d Entities.", len(snapshot))
        await self._broadcast({"type": "snapshot", "states": snapshot})

    async def _on_state_change(self, entity_id: str, state: dict[str, Any] | None) -> None:
        if state is None:
            self._states.pop(entity_id, None)
        else:
            self._states[entity_id] = state
        await self._broadcast({"type": "state", "entity_id": entity_id, "state": state})

    # ---- Frontend-Clients -------------------------------------------------

    async def connect_client(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._clients.add(ws)
        # Sofort-Snapshot für den neuen Client.
        await ws.send_json(
            {"type": "snapshot", "states": self._states, "ha_connected": self.ha.connected}
        )
        log.info("Frontend-Client verbunden (%d aktiv).", len(self._clients))

    async def disconnect_client(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(ws)
        log.info("Frontend-Client getrennt (%d aktiv).", len(self._clients))

    async def _broadcast(self, message: dict[str, Any]) -> None:
        if not self._clients:
            return
        async with self._lock:
            targets = list(self._clients)
        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception:  # noqa: BLE001 — toten Client aussortieren
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._clients.discard(ws)

    # ---- Service-Aufrufe --------------------------------------------------

    async def call_service(
        self,
        domain: str,
        service: str,
        entity_id: str | list[str] | None,
        service_data: dict[str, Any] | None,
    ) -> None:
        await self.ha.call_service(
            domain, service, entity_id=entity_id, service_data=service_data
        )
