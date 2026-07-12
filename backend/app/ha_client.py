"""Asynchroner Home-Assistant-WebSocket-Client.

Protokoll (vereinfacht):
  1. Verbinden -> Server sendet {"type": "auth_required"}
  2. Client   -> {"type": "auth", "access_token": ...}
  3. Server   -> {"type": "auth_ok"} | {"type": "auth_invalid"}
  4. Danach Kommandos mit aufsteigender id:
       subscribe_events(state_changed), get_states, call_service
     Server antwortet mit {"type": "result", id, success, result}
     und (für Subscriptions) {"type": "event", id, event}

Der Client hält die Verbindung mit Backoff-Reconnect am Leben und meldet
State-Änderungen sowie (Re-)Verbindungen über Callbacks an den Hub.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Awaitable, Callable

import aiohttp

log = logging.getLogger("webdashboardha.ha")

# Typ-Aliase für die Callbacks, die der Hub registriert.
StateChangeCb = Callable[[str, dict[str, Any] | None], Awaitable[None]]
ConnectedCb = Callable[[dict[str, dict[str, Any]]], Awaitable[None]]

_CMD_TIMEOUT = 10.0  # Sekunden auf eine Kommando-Antwort warten
_MAX_BACKOFF = 30.0


class HAAuthError(Exception):
    """Auth wurde von HA abgelehnt (falsches/abgelaufenes Token)."""


class HAClient:
    def __init__(
        self,
        ws_url: str,
        token: str,
        *,
        on_state_change: StateChangeCb,
        on_connected: ConnectedCb,
    ) -> None:
        self._ws_url = ws_url
        self._token = token
        self._on_state_change = on_state_change
        self._on_connected = on_connected

        self._session: aiohttp.ClientSession | None = None
        self._ws: aiohttp.ClientWebSocketResponse | None = None
        self._id = 0
        self._pending: dict[int, asyncio.Future[dict[str, Any]]] = {}
        self._task: asyncio.Task[None] | None = None
        self._stopped = False
        self.connected = False

    # ---- Lebenszyklus -----------------------------------------------------

    def start(self) -> None:
        """Startet die Verbindungs-/Reconnect-Schleife als Hintergrund-Task."""
        self._stopped = False
        self._task = asyncio.create_task(self._run_forever(), name="ha-client")

    async def stop(self) -> None:
        self._stopped = True
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._session:
            await self._session.close()

    async def _run_forever(self) -> None:
        backoff = 1.0
        while not self._stopped:
            try:
                await self._connect_and_listen()
                backoff = 1.0  # nach sauberem Lauf zurücksetzen
            except asyncio.CancelledError:
                raise
            except HAAuthError:
                log.error("HA-Auth abgelehnt — Token prüfen. Kein Reconnect.")
                return
            except Exception as exc:  # noqa: BLE001 — Reconnect auf alles
                log.warning("HA-Verbindung verloren (%s). Reconnect in %.0fs.", exc, backoff)
            finally:
                self.connected = False

            if self._stopped:
                break
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, _MAX_BACKOFF)

    async def _connect_and_listen(self) -> None:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()

        log.info("Verbinde mit HA: %s", self._ws_url)
        async with self._session.ws_connect(self._ws_url, heartbeat=30) as ws:
            self._ws = ws
            await self._authenticate(ws)
            self.connected = True
            log.info("HA authentifiziert.")

            # Read-Loop VOR den Kommandos starten: die result-Antworten auf
            # subscribe_events/get_states werden erst durch den laufenden Loop
            # dispatcht. Andernfalls laufen die Kommandos in den Timeout.
            read_task = asyncio.create_task(self._read_loop(ws))
            try:
                # Erst Subscription, dann Snapshot — so entgeht uns kein Event.
                await self._send_command(
                    {"type": "subscribe_events", "event_type": "state_changed"}
                )
                states = await self._send_command({"type": "get_states"})
                snapshot = {s["entity_id"]: s for s in states.get("result", [])}
                await self._on_connected(snapshot)

                # Bis zum Verbindungsende laufen lassen (read_task wirft dann).
                await read_task
            finally:
                read_task.cancel()
                # Offene Kommando-Futures aufräumen, damit nichts hängen bleibt.
                for fut in self._pending.values():
                    if not fut.done():
                        fut.cancel()
                self._pending.clear()

    async def _authenticate(self, ws: aiohttp.ClientWebSocketResponse) -> None:
        first = await ws.receive_json()
        if first.get("type") != "auth_required":
            raise RuntimeError(f"Unerwartete erste HA-Nachricht: {first!r}")
        await ws.send_json({"type": "auth", "access_token": self._token})
        result = await ws.receive_json()
        if result.get("type") != "auth_ok":
            raise HAAuthError(result.get("message", "auth_invalid"))

    # ---- Kommandos --------------------------------------------------------

    def _next_id(self) -> int:
        self._id += 1
        return self._id

    async def _send_command(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Sendet ein Kommando und wartet auf das zugehörige result."""
        if self._ws is None:
            raise RuntimeError("Nicht verbunden")
        cmd_id = self._next_id()
        payload = {**payload, "id": cmd_id}
        fut: asyncio.Future[dict[str, Any]] = asyncio.get_event_loop().create_future()
        self._pending[cmd_id] = fut
        await self._ws.send_json(payload)
        try:
            result = await asyncio.wait_for(fut, _CMD_TIMEOUT)
        finally:
            self._pending.pop(cmd_id, None)
        if not result.get("success", False):
            err = result.get("error", {})
            raise RuntimeError(f"HA-Kommando fehlgeschlagen: {err}")
        return result

    async def call_service(
        self,
        domain: str,
        service: str,
        *,
        entity_id: str | list[str] | None = None,
        service_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "type": "call_service",
            "domain": domain,
            "service": service,
        }
        if service_data:
            payload["service_data"] = service_data
        if entity_id is not None:
            payload["target"] = {"entity_id": entity_id}
        return await self._send_command(payload)

    # ---- Empfang ----------------------------------------------------------

    async def _read_loop(self, ws: aiohttp.ClientWebSocketResponse) -> None:
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                await self._dispatch(msg.json())
            elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                break
        raise ConnectionError("HA-WebSocket geschlossen")

    async def _dispatch(self, data: dict[str, Any]) -> None:
        mtype = data.get("type")
        if mtype == "result":
            fut = self._pending.get(data["id"])
            if fut and not fut.done():
                fut.set_result(data)
        elif mtype == "event":
            event = data.get("event", {})
            if event.get("event_type") == "state_changed":
                ev = event.get("data", {})
                entity_id = ev.get("entity_id")
                new_state = ev.get("new_state")  # None = Entity gelöscht
                if entity_id:
                    await self._on_state_change(entity_id, new_state)
