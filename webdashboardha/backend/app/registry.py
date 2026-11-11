"""HA registries (areas, devices, entities, labels), read-only.

Loaded via the WS list commands after auth and kept fresh through the
``*_registry_updated`` events. Reloads are debounced (2 s), because HA fires
bursts of events when an integration reloads. Nothing is ever written.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Awaitable, Callable, Protocol

log = logging.getLogger("webdashboardha.registry")

LIST_COMMANDS = {
    "areas": "config/area_registry/list",
    "devices": "config/device_registry/list",
    "entities": "config/entity_registry/list",
    "labels": "config/label_registry/list",
}
UPDATE_EVENTS = (
    "area_registry_updated",
    "device_registry_updated",
    "entity_registry_updated",
    "label_registry_updated",
)

_ENTITY_FIELDS = (
    "entity_id", "id", "device_id", "area_id", "labels", "hidden_by", "disabled_by",
    "entity_category", "platform", "unique_id", "name", "original_name",
)
_DEVICE_FIELDS = ("id", "area_id", "name_by_user", "name", "model", "manufacturer")


class CommandClient(Protocol):
    async def send_command(self, payload: dict[str, Any]) -> dict[str, Any]: ...

    async def subscribe_events(self, event_type: str) -> None: ...


RenameCb = Callable[[str, str], None]
ChangeCb = Callable[[], Awaitable[None]]


class Registry:
    def __init__(
        self,
        *,
        on_change: ChangeCb | None = None,
        on_rename: RenameCb | None = None,
        debounce_s: float = 2.0,
    ) -> None:
        self.areas: dict[str, dict[str, Any]] = {}
        self.devices: dict[str, dict[str, Any]] = {}
        self.entities: dict[str, dict[str, Any]] = {}
        self.labels: dict[str, dict[str, Any]] = {}
        self.loaded = False
        self._on_change = on_change
        self._on_rename = on_rename
        self._debounce_s = debounce_s
        self._client: CommandClient | None = None
        self._reload_task: asyncio.Task[None] | None = None

    # ---- building ---------------------------------------------------------

    def set_lists(
        self,
        *,
        areas: list[dict[str, Any]],
        devices: list[dict[str, Any]],
        entities: list[dict[str, Any]],
        labels: list[dict[str, Any]],
    ) -> None:
        self.areas = {a["area_id"]: {"area_id": a["area_id"], "name": a.get("name")} for a in areas}
        self.devices = {d["id"]: {k: d.get(k) for k in _DEVICE_FIELDS} for d in devices}
        self.entities = {}
        for e in entities:
            entry = {k: e.get(k) for k in _ENTITY_FIELDS}
            entry["labels"] = list(entry.get("labels") or [])
            self.entities[e["entity_id"]] = entry
        self.labels = {lb["label_id"]: {"label_id": lb["label_id"], "name": lb.get("name")} for lb in labels}
        self.loaded = True

    @classmethod
    def from_lists(cls, **lists: list[dict[str, Any]]) -> "Registry":
        reg = cls()
        reg.set_lists(**lists)  # type: ignore[arg-type]
        return reg

    async def load(self, client: CommandClient) -> None:
        """Fetch all four lists. On failure keep the previous content."""
        self._client = client
        results: dict[str, list[dict[str, Any]]] = {}
        for key, cmd in LIST_COMMANDS.items():
            res = await client.send_command({"type": cmd})
            results[key] = res.get("result") or []
        self.set_lists(**results)
        log.info(
            "Registry: %d Bereiche, %d Geräte, %d Entitäten, %d Labels.",
            len(self.areas), len(self.devices), len(self.entities), len(self.labels),
        )

    async def subscribe(self, client: CommandClient) -> None:
        self._client = client
        for ev in UPDATE_EVENTS:
            await client.subscribe_events(ev)

    # ---- events -----------------------------------------------------------

    def handle_event(self, event_type: str, data: dict[str, Any]) -> None:
        """Sync handler (runs inside the HA read loop): rename now, reload later."""
        if event_type not in UPDATE_EVENTS:
            return
        if event_type == "entity_registry_updated" and data.get("action") == "update":
            old, new = data.get("old_entity_id"), data.get("entity_id")
            if old and new and old != new:
                entry = self.entities.pop(old, None)
                if entry is not None:
                    self.entities[new] = {**entry, "entity_id": new}
                if self._on_rename:
                    self._on_rename(old, new)
        self.schedule_reload()

    def schedule_reload(self) -> None:
        if self._reload_task and not self._reload_task.done():
            self._reload_task.cancel()
        self._reload_task = asyncio.create_task(self._debounced_reload())

    async def _debounced_reload(self) -> None:
        await asyncio.sleep(self._debounce_s)
        if self._client is None:
            return
        try:
            await self.load(self._client)
        except Exception as exc:  # noqa: BLE001 — keep the old registry
            log.warning("Registry-Neuladen fehlgeschlagen: %s", exc)
            return
        if self._on_change:
            await self._on_change()

    def cancel(self) -> None:
        if self._reload_task and not self._reload_task.done():
            self._reload_task.cancel()

    # ---- queries ----------------------------------------------------------

    def entity(self, entity_id: str) -> dict[str, Any] | None:
        return self.entities.get(entity_id)

    def device_of(self, entity_id: str) -> dict[str, Any] | None:
        entry = self.entities.get(entity_id)
        if not entry or not entry.get("device_id"):
            return None
        return self.devices.get(entry["device_id"])

    def effective_area(self, entity_id: str) -> str | None:
        entry = self.entities.get(entity_id)
        if not entry:
            return None
        if entry.get("area_id"):
            return entry["area_id"]
        device = self.devices.get(entry.get("device_id") or "")
        return device.get("area_id") if device else None

    def labels_of(self, entity_id: str) -> list[str]:
        entry = self.entities.get(entity_id)
        return list(entry.get("labels") or []) if entry else []

    def label_entities(self, label_id: str) -> list[str]:
        return [eid for eid, e in self.entities.items() if label_id in (e.get("labels") or [])]
