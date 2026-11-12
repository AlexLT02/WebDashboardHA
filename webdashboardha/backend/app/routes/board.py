"""v2 REST: /api/board, /api/actions/*, /api/zones/* (local only, nothing in HA)."""

from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..actions import ActionError, ActionNotFound, UndoExpired
from ..dependencies import HubDep
from ..hub import Hub
from ..zones import FAVORITES_MAX, ZoneError, validate_name

log = logging.getLogger("webdashboardha.board")

router = APIRouter(prefix="/api", tags=["board"])


def _board(hub: Hub) -> dict[str, Any]:
    data = hub.board_json()
    if data is None:
        raise HTTPException(status_code=503, detail="Board noch nicht gebaut (HA nicht verbunden)")
    return data


@router.get("/board")
async def get_board(hub: HubDep) -> dict[str, Any]:
    return _board(hub)


# ---- actions ------------------------------------------------------------------------


class OffRequest(BaseModel):
    scope: Literal["alles_aus", "zone", "group", "ambiente", "lights"]
    id: str | None = None


class OnRequest(BaseModel):
    scope: Literal["ambiente", "group"]
    id: str | None = None
    brightness_pct: int | None = Field(default=None, ge=1, le=100)


class UndoRequest(BaseModel):
    undo: str = Field(min_length=1)


def _require_ha(hub: Hub) -> None:
    if not hub.ha_connected:
        raise HTTPException(status_code=503, detail="HA nicht verbunden")


@router.post("/actions/off")
async def action_off(payload: OffRequest, hub: HubDep) -> dict[str, Any]:
    board = _board(hub)
    _require_ha(hub)
    try:
        return await hub.actions.off(payload.scope, payload.id, board, hub.states_view(), hub.registry)
    except ActionNotFound as exc:
        raise HTTPException(status_code=404, detail=f"unbekannt: {payload.id}") from exc
    except ActionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        log.warning("actions/off fehlgeschlagen: %s", exc)
        raise HTTPException(status_code=502, detail=f"HA-Fehler: {exc}") from exc


@router.post("/actions/on")
async def action_on(payload: OnRequest, hub: HubDep) -> dict[str, Any]:
    board = _board(hub)
    _require_ha(hub)
    try:
        return await hub.actions.on(payload.scope, payload.id, board, payload.brightness_pct)
    except ActionNotFound as exc:
        raise HTTPException(status_code=404, detail=f"unbekannt: {payload.id}") from exc
    except ActionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        log.warning("actions/on fehlgeschlagen: %s", exc)
        raise HTTPException(status_code=502, detail=f"HA-Fehler: {exc}") from exc


@router.post("/actions/undo")
async def action_undo(payload: UndoRequest, hub: HubDep) -> dict[str, str]:
    _require_ha(hub)
    try:
        await hub.actions.undo(payload.undo)
    except UndoExpired as exc:
        raise HTTPException(status_code=410, detail="Rückgängig abgelaufen") from exc
    except Exception as exc:  # noqa: BLE001
        log.warning("actions/undo fehlgeschlagen: %s", exc)
        raise HTTPException(status_code=502, detail=f"HA-Fehler: {exc}") from exc
    return {"status": "ok"}


# ---- zones --------------------------------------------------------------------------


class ItemPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    zone: str | None = None
    name: str | None = None
    tier: Literal["zone", "all", "hidden"] | None = None
    func: Literal["licht", "ambiente", "medien", "klima"] | None = None
    order_step: Literal[-1, 1] | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        return None if v is None else validate_name(v)


class FavoritesPut(BaseModel):
    ids: list[str] = Field(max_length=FAVORITES_MAX)
    # P5: label of a favourite tile, edited from the start screen (1..14 characters).
    names: dict[str, str] | None = None

    @field_validator("names")
    @classmethod
    def _names(cls, v: dict[str, str] | None) -> dict[str, str] | None:
        return None if v is None else {k: validate_name(n) for k, n in v.items()}


def _known(hub: Hub, item_id: str) -> bool:
    board = hub.board_json() or {}
    return item_id in board.get("items", {}) or item_id in hub.zones.items \
        or item_id in hub.zones.group_ids()


def _section_peers(hub: Hub, item_id: str) -> list[str]:
    for zone in (hub.board_json() or {}).get("zones", []):
        for section in zone.get("sections", []):
            if item_id in section["items"]:
                return list(section["items"])
        for key in ("all_only", "chips"):
            if item_id in zone.get(key, []):
                return list(zone[key])
    return []


async def _changed(hub: Hub) -> dict[str, int]:
    await hub.rebuild()
    return {"rev": hub.rev}


@router.patch("/zones/items/{item_id}")
async def patch_item(item_id: str, payload: ItemPatch, hub: HubDep) -> dict[str, int]:
    if not _known(hub, item_id):
        raise HTTPException(status_code=404, detail=f"unbekannt: {item_id}")
    changes = {k: getattr(payload, k) for k in payload.model_fields_set}
    for key in ("tier", "func", "order_step"):
        if key in changes and changes[key] is None:
            raise HTTPException(status_code=422, detail=f"{key} darf nicht null sein")
    item = ((hub.board_json() or {}).get("items") or {}).get(item_id) or {}
    try:
        hub.zones.patch(
            item_id, changes, ha_name=item.get("name"),
            section_peers=lambda iid: _section_peers(hub, iid),
        )
    except ZoneError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return await _changed(hub)


@router.post("/zones/items/{item_id}/reset")
async def reset_item(item_id: str, hub: HubDep) -> dict[str, int]:
    if not _known(hub, item_id):
        raise HTTPException(status_code=404, detail=f"unbekannt: {item_id}")
    hub.zones.reset(item_id)
    return await _changed(hub)


@router.post("/zones/items/{item_id}/seen")
async def seen_item(item_id: str, hub: HubDep) -> dict[str, int]:
    if not _known(hub, item_id):
        raise HTTPException(status_code=404, detail=f"unbekannt: {item_id}")
    hub.zones.mark_seen(item_id)
    return await _changed(hub)


@router.put("/zones/favorites")
async def put_favorites(payload: FavoritesPut, hub: HubDep) -> dict[str, int]:
    items = (hub.board_json() or {}).get("items", {})
    unknown = [i for i in payload.ids if i not in items]
    if unknown:
        raise HTTPException(status_code=404, detail=f"unbekannt: {', '.join(unknown)}")
    stray = [i for i in (payload.names or {}) if i not in payload.ids]
    if stray:
        raise HTTPException(status_code=422, detail=f"Name für Nicht-Favorit: {', '.join(stray)}")
    try:
        hub.zones.set_favorites(payload.ids, {i: items[i]["name"] for i in payload.ids}, labels=payload.names)
    except ZoneError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return await _changed(hub)
