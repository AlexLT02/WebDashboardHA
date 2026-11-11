"""Bulk actions (off/on) with a one-slot undo via ``scene.create``.

Targets come from the board model only. Light groups and media players never
go into the snapshot: a restored group would switch all members on.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from .board import GROUP_KINDS, domain_of
from .registry import Registry

log = logging.getLogger("webdashboardha.actions")

ServiceCaller = Callable[[str, str, Any, "dict[str, Any] | None"], Awaitable[None]]

OFF_SCOPES = ("alles_aus", "zone", "group", "ambiente", "lights")
ON_SCOPES = ("ambiente", "group")
UNDO_ALLES_AUS_S = 10.0
UNDO_DEFAULT_S = 8.0
UNDO_GRACE_S = 5.0
TV_OFF_STATES = {"off", "unavailable", "unknown", "standby"}
SNAPSHOT_DOMAINS = ("light", "switch", "input_boolean", "fan")
SCRIPT_DOMAINS = ("switch", "light", "fan", "media_player")


class ActionError(ValueError):
    """Bad request (422)."""


class ActionNotFound(KeyError):
    """Unknown zone/group id (404)."""


class UndoExpired(Exception):
    """Undo token unknown or expired (410)."""


@dataclass
class _UndoSlot:
    token: str
    deadline: float


class ActionService:
    def __init__(
        self,
        call: ServiceCaller,
        *,
        clock: Callable[[], float] = time.monotonic,
        scene_id: str = "wdh_undo",
    ) -> None:
        self._call = call
        self._clock = clock
        self._scene_id = scene_id
        self._slot: _UndoSlot | None = None
        self._seq = 0

    # ---- targets ----------------------------------------------------------------

    @staticmethod
    def _is_on(states: dict[str, dict[str, Any]], eid: str) -> bool:
        return (states.get(eid) or {}).get("state") == "on"

    @staticmethod
    def _kg(board: dict[str, Any], role: str, gid: str | None = None) -> dict[str, Any] | None:
        for kg in board.get("start", {}).get("kommen_gehen", []):
            if kg.get("role") == role and (gid is None or kg.get("id") == gid):
                return kg
        return None

    def _group(self, board: dict[str, Any], gid: str | None) -> tuple[str, list[str], str]:
        """(kind, members, name) of a chip/favorite group or a K&G group."""
        item = board.get("items", {}).get(gid or "")
        if item and item.get("kind") in GROUP_KINDS:
            return item["kind"], list(item.get("members") or []), item.get("name") or gid
        kg = self._kg(board, "group", gid)
        if kg:
            return "group", list(kg.get("members") or []), kg.get("name") or gid
        raise ActionNotFound(gid)

    def off_targets(
        self, scope: str, target_id: str | None, board: dict[str, Any],
        states: dict[str, dict[str, Any]], registry: Registry,
    ) -> tuple[list[str], str]:
        items = board.get("items", {})
        on = lambda eid: self._is_on(states, eid)  # noqa: E731
        if scope == "alles_aus":
            kg = self._kg(board, "alles_aus") or {}
            area, label = kg.get("area"), kg.get("label")
            exceptions = set(registry.label_entities(kg.get("exception_label") or ""))

            def covered(eid: str) -> bool:
                if eid in exceptions:
                    return False
                d = domain_of(eid)
                if d == "light" and registry.effective_area(eid) == area:
                    return True
                return d in SCRIPT_DOMAINS and label in registry.labels_of(eid)

            targets = [
                eid for eid, it in items.items()
                if it.get("kind") not in GROUP_KINDS and not eid.startswith("virtual.")
                and it.get("tier") != "hidden"
                and domain_of(eid) in ("light", "switch", "input_boolean")
                and on(eid) and covered(eid)
            ]
            return sorted(targets), kg.get("name") or "Alles aus"
        if scope == "zone":
            zone = next((z for z in board.get("zones", []) if z["id"] == target_id), None)
            if zone is None:
                raise ActionNotFound(target_id)
            return [e for e in zone.get("light_targets", []) if on(e)], f"{zone['name']}: Licht aus"
        if scope == "group":
            _kind, members, name = self._group(board, target_id)
            return [m for m in members if on(m)], f"{name} aus"
        if scope == "ambiente":
            kg = self._kg(board, "ambiente") or {}
            return [e for e in kg.get("count", []) if on(e)], f"{kg.get('name') or 'Ambiente'} aus"
        if scope == "lights":
            targets = [
                eid for eid, it in items.items()
                if domain_of(eid) == "light" and it.get("count") and it.get("tier") != "hidden"
                and it.get("kind") not in GROUP_KINDS and on(eid)
            ]
            return sorted(targets), "Alle Lichter aus"
        raise ActionError(f"unbekannter scope: {scope}")

    # ---- off / undo ---------------------------------------------------------------

    async def off(
        self, scope: str, target_id: str | None, board: dict[str, Any],
        states: dict[str, dict[str, Any]], registry: Registry,
    ) -> dict[str, Any]:
        targets, label = self.off_targets(scope, target_id, board, states, registry)
        result: dict[str, Any] = {
            "undo": None, "label": label, "count": len(targets),
            "hint": open_contacts_hint(board, states), "partial": False, "expires_in": 0,
        }
        if not targets:
            return result

        snapshot = [
            e for e in targets
            if domain_of(e) in SNAPSHOT_DOMAINS
            and not ((states.get(e) or {}).get("attributes") or {}).get("entity_id")
        ]
        snap_ok = False
        if snapshot:
            try:
                await self._call("scene", "create", None,
                                 {"scene_id": self._scene_id, "snapshot_entities": snapshot})
                snap_ok = True
            except Exception as exc:  # noqa: BLE001 — switching off matters more than undo
                log.warning("Undo-Snapshot fehlgeschlagen: %s", exc)

        await self._execute_off(scope, target_id, targets, board)

        if scope == "alles_aus":
            tv = (board.get("items", {}).get("virtual.fernsehen") or {}).get("tv")
            result["partial"] = bool(tv) and (states.get(tv) or {}).get("state") not in TV_OFF_STATES | {None}
        if snap_ok:
            ttl = UNDO_ALLES_AUS_S if scope == "alles_aus" else UNDO_DEFAULT_S
            grace = 0.0 if scope == "alles_aus" else UNDO_GRACE_S
            self._seq += 1
            self._slot = _UndoSlot(f"u{self._seq}", self._clock() + ttl + grace)
            result["undo"] = self._slot.token
            result["expires_in"] = int(ttl)
        return result

    async def _execute_off(
        self, scope: str, target_id: str | None, targets: list[str], board: dict[str, Any],
    ) -> None:
        if scope == "alles_aus":
            kg = self._kg(board, "alles_aus") or {}
            await self._call("script", "turn_on", kg.get("script") or "script.alles_aus", None)
        elif scope == "ambiente":
            await self._call("homeassistant", "turn_off", targets, None)
        elif scope == "group":
            kind, _members, _name = self._group(board, target_id)
            await self._call("switch" if kind == "switch_group" else "light", "turn_off", targets, None)
        else:  # zone, lights: per domain
            for dom in ("light", "input_boolean"):
                ids = [e for e in targets if domain_of(e) == dom]
                if ids:
                    await self._call(dom, "turn_off", ids, None)

    async def undo(self, token: str) -> None:
        slot = self._slot
        if slot is None or slot.token != token or self._clock() > slot.deadline:
            raise UndoExpired(token)
        self._slot = None
        await self._call("scene", "turn_on", f"scene.{self._scene_id}", None)

    # ---- on ---------------------------------------------------------------------

    async def on(
        self, scope: str, target_id: str | None, board: dict[str, Any],
        brightness_pct: int | None = None,
    ) -> dict[str, Any]:
        if scope == "ambiente":
            kg = self._kg(board, "ambiente") or {}
            action = list(kg.get("action") or [])
            if action:
                await self._call("homeassistant", "turn_on", action, None)
            return {"status": "ok", "count": len(action)}
        if scope == "group":
            kind, members, _name = self._group(board, target_id)
            if kind == "switch_group":
                await self._call("switch", "turn_on", members, None)
                return {"status": "ok", "count": len(members)}
            data = {"brightness_pct": brightness_pct} if brightness_pct else None
            await self._call("light", "turn_on", target_id, data)
            return {"status": "ok", "count": len(members)}
        raise ActionError(f"unbekannter scope: {scope}")


def open_contacts_hint(board: dict[str, Any], states: dict[str, dict[str, Any]]) -> str | None:
    names: list[str] = []
    for block in board.get("start", {}).get("lage", []):
        if block.get("key") != "oeffnungen":
            continue
        for c in block.get("contacts", []):
            if (states.get(c["id"]) or {}).get("state") == "on":
                names.append(c.get("name") or c["id"])
    if not names:
        return None
    text = ", ".join(names[:2])
    if len(names) > 2:
        text += f" +{len(names) - 2}"
    return f"{text} offen"
