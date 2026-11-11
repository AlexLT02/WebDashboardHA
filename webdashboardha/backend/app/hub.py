"""State-Hub: hält den einen HA-Client, cached alle Entity-States und fächert
Änderungen an alle verbundenen Frontend-WebSockets aus.

Design: Nur EINE HA-Subscription für beliebig viele iPads. Neue Clients bekommen
sofort einen Snapshot, danach nur noch Deltas. Das schont die alte Hardware und
hält HA-seitig die Verbindungszahl minimal.

v1 (``/ws``): full state stream, unchanged for the 1.4.2 frontend.
v2 (``/ws?v=2``): hello, board, snapshot of the watch-set only, then filtered
and throttled deltas. The board is rebuilt on registry/zone changes.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Callable

from fastapi import WebSocket

from . import __version__
from .actions import ActionService
from .board import Board, build_board, domain_of, slim_state
from .config import Settings
from .ha_client import HAClient
from .registry import Registry
from .storage import DashboardStore
from .zones import ZoneStore, load_seed

log = logging.getLogger("webdashboardha.hub")

THROTTLE_CLASSES = {"power", "current", "voltage", "energy"}
THROTTLE_S = 10.0
REBUILD_DEBOUNCE_S = 2.0
# Attribute changes that alter the board (kind, features, group members).
STRUCTURAL_ATTRS = ("entity_id", "supported_color_modes", "min_color_temp_kelvin",
                    "max_color_temp_kelvin", "supported_features")


class Hub:
    def __init__(
        self,
        settings: Settings,
        *,
        dashboards: DashboardStore | None = None,
        zones: ZoneStore | None = None,
        ha_factory: Callable[..., Any] = HAClient,
        clock: Callable[[], float] = time.monotonic,
        wall: Callable[[], float] = time.time,
        rebuild_debounce_s: float = REBUILD_DEBOUNCE_S,
    ) -> None:
        self._settings = settings
        self._states: dict[str, dict[str, Any]] = {}
        self._virtual: dict[str, dict[str, Any]] = {}  # wdh.* (forecast, P3)
        self._clients: set[WebSocket] = set()
        self._clients_v2: set[WebSocket] = set()
        self._lock = asyncio.Lock()
        self._clock = clock
        self._wall = wall
        self._debounce_s = rebuild_debounce_s
        self._dashboards = dashboards
        self.zones = zones or ZoneStore(settings.data_dir / "zones.json", load_seed(), now=wall)
        self.registry = Registry(on_change=self._on_registry_change, on_rename=self._on_rename)
        self.board: Board | None = None
        self.rev = 0
        self._rebuild_task: asyncio.Task[None] | None = None
        self._last_sent: dict[str, float] = {}
        self._throttled: dict[str, dict[str, Any]] = {}
        self._flush_tasks: dict[str, asyncio.Task[None]] = {}
        self.ha = ha_factory(
            settings.ha_ws_url,
            settings.ha_token,
            on_state_change=self._on_state_change,
            on_connected=self._on_connected,
            on_authenticated=self._on_authenticated,
            on_event=self._on_event,
            on_disconnected=self._on_disconnected,
        )
        self.actions = ActionService(self.call_service, scene_id=self.zones.seed.get("undo_scene_id", "wdh_undo"))

    # ---- Lebenszyklus -----------------------------------------------------

    def start(self) -> None:
        self.zones.load()
        self.ha.start()

    async def stop(self) -> None:
        self.registry.cancel()
        for task in [self._rebuild_task, *self._flush_tasks.values()]:
            if task and not task.done():
                task.cancel()
        await self.ha.stop()

    @property
    def ha_connected(self) -> bool:
        return self.ha.connected

    def snapshot(self) -> dict[str, dict[str, Any]]:
        return dict(self._states)

    def states_view(self) -> dict[str, dict[str, Any]]:
        return {**self._states, **self._virtual}

    def board_json(self) -> dict[str, Any] | None:
        if self.board is None:
            return None
        return {"rev": self.rev, **self.board.data}

    # ---- HA-Callbacks -----------------------------------------------------

    async def _on_authenticated(self) -> None:
        try:
            await self.registry.load(self.ha)
            await self.registry.subscribe(self.ha)
        except Exception as exc:  # noqa: BLE001 — board still works from the seed
            log.warning("Registry nicht ladbar (%s), Eingangskorb bleibt leer.", exc)

    async def _on_connected(self, snapshot: dict[str, dict[str, Any]]) -> None:
        """(Re-)Verbindung zu HA: kompletten State-Cache ersetzen und Clients
        einen frischen Snapshot schicken (falls sie eine HA-Downtime überlebt haben)."""
        self._states = snapshot
        log.info("HA-Snapshot: %d Entities.", len(snapshot))
        await self._broadcast({"type": "snapshot", "states": snapshot})
        await self._broadcast_v2({"type": "ha_status", "connected": True})
        await self.rebuild(force_send=True)

    async def _on_disconnected(self) -> None:
        await self._broadcast_v2({"type": "ha_status", "connected": False})

    async def _on_event(self, event_type: str, data: dict[str, Any]) -> None:
        self.registry.handle_event(event_type, data)

    def _on_rename(self, old: str, new: str) -> None:
        if self.zones.rename(old, new):
            log.info("Umbenannt in HA: %s -> %s (zones.json umgeschlüsselt).", old, new)
        self.schedule_rebuild()

    async def _on_registry_change(self) -> None:
        await self.rebuild()

    async def _on_state_change(self, entity_id: str, state: dict[str, Any] | None) -> None:
        old = self._states.get(entity_id)
        if state is None:
            self._states.pop(entity_id, None)
        else:
            self._states[entity_id] = state
        await self._broadcast({"type": "state", "entity_id": entity_id, "state": state})

        board = self.board
        if (old is None) != (state is None):
            self.schedule_rebuild()  # entity appeared or vanished
        elif board and entity_id in board.data["items"] and _structural_change(old, state):
            self.schedule_rebuild()
        if board and entity_id in board.watch:
            await self._send_state_v2(entity_id, state)

    # ---- board ------------------------------------------------------------------

    def _ui_settings(self) -> dict[str, Any]:
        if self._dashboards is None:
            return {}
        try:
            dash = self._dashboards.get("default") or next(iter(self._dashboards.list()), None)
        except Exception as exc:  # noqa: BLE001
            log.warning("Dashboard-Settings unlesbar: %s", exc)
            return {}
        return dict((dash.meta or {}).get("settings") or {}) if dash else {}

    async def rebuild(self, *, force_send: bool = False) -> bool:
        """Rebuild the board; broadcast board + snapshot if it changed."""
        board = build_board(
            self.zones.seed, self.zones, self.registry, self.states_view(), self._wall(),
            self._ui_settings(),
        )
        if board.first_seen_new:
            self.zones.first_seen_add(board.first_seen_new)
        changed = self.board is None or board.data != self.board.data or board.watch != self.board.watch
        if changed:
            self.rev += 1
        self.board = board
        if changed or force_send:
            await self._broadcast_v2({"type": "board", "rev": self.rev, "board": self.board_json()})
            await self._broadcast_v2({"type": "snapshot", "states": self.v2_snapshot()})
        return changed

    def schedule_rebuild(self) -> None:
        if self._rebuild_task and not self._rebuild_task.done():
            self._rebuild_task.cancel()
        self._rebuild_task = asyncio.create_task(self._debounced_rebuild())

    async def _debounced_rebuild(self) -> None:
        await asyncio.sleep(self._debounce_s)
        await self.rebuild()

    def v2_snapshot(self) -> dict[str, dict[str, Any]]:
        if self.board is None:
            return {}
        states = self.states_view()
        return {eid: slim_state(states[eid]) for eid in sorted(self.board.watch) if eid in states}

    def set_virtual_state(self, entity_id: str, state: dict[str, Any]) -> None:
        """Hook for wdh.* states (forecast.py, P3)."""
        self._virtual[entity_id] = state

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

    async def connect_client_v2(self, ws: WebSocket) -> None:
        await ws.accept()
        await ws.send_json({"type": "hello", "version": __version__, "ha_connected": self.ha.connected})
        if self.board is not None:
            await ws.send_json({"type": "board", "rev": self.rev, "board": self.board_json()})
            await ws.send_json({"type": "snapshot", "states": self.v2_snapshot()})
        async with self._lock:
            self._clients_v2.add(ws)
        log.info("Frontend-Client v2 verbunden (%d aktiv).", len(self._clients_v2))

    async def disconnect_client(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(ws)
            self._clients_v2.discard(ws)
        log.info("Frontend-Client getrennt (%d v1, %d v2).", len(self._clients), len(self._clients_v2))

    async def _broadcast(self, message: dict[str, Any]) -> None:
        await self._send_all(self._clients, message)

    async def _broadcast_v2(self, message: dict[str, Any]) -> None:
        await self._send_all(self._clients_v2, message)

    async def _send_all(self, clients: set[WebSocket], message: dict[str, Any]) -> None:
        if not clients:
            return
        async with self._lock:
            targets = list(clients)
        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception:  # noqa: BLE001 — toten Client aussortieren
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    clients.discard(ws)

    # ---- v2 delta + throttle ----------------------------------------------------

    async def _send_state_v2(self, entity_id: str, state: dict[str, Any] | None) -> None:
        if state is not None and _is_throttled_class(entity_id, state):
            now = self._clock()
            last = self._last_sent.get(entity_id)
            if last is not None and now - last < THROTTLE_S:
                self._throttled[entity_id] = state  # last value wins
                if entity_id not in self._flush_tasks:
                    self._flush_tasks[entity_id] = asyncio.create_task(
                        self._flush_later(entity_id, THROTTLE_S - (now - last))
                    )
                return
            self._last_sent[entity_id] = now
        else:
            self._throttled.pop(entity_id, None)
        await self._broadcast_v2({
            "type": "state", "entity_id": entity_id,
            "state": slim_state(state) if state is not None else None,
        })

    async def _flush_later(self, entity_id: str, delay: float) -> None:
        try:
            await asyncio.sleep(max(0.0, delay))
        finally:
            self._flush_tasks.pop(entity_id, None)
        state = self._throttled.pop(entity_id, None)
        if state is not None:
            self._last_sent[entity_id] = self._clock()
            await self._broadcast_v2({"type": "state", "entity_id": entity_id, "state": slim_state(state)})

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


def _is_throttled_class(entity_id: str, state: dict[str, Any]) -> bool:
    return domain_of(entity_id) == "sensor" and \
        (state.get("attributes") or {}).get("device_class") in THROTTLE_CLASSES


def _structural_change(old: dict[str, Any] | None, new: dict[str, Any] | None) -> bool:
    a = (old or {}).get("attributes") or {}
    b = (new or {}).get("attributes") or {}
    return any(a.get(k) != b.get(k) for k in STRUCTURAL_ATTRS)
