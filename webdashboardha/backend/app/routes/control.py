"""Steuerungs- und State-Routen: /api/service, /api/states."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException

from ..calendar import fetch_google_events, normalize_calendar_config
from ..dependencies import HubDep
from ..schemas import ServiceCall

log = logging.getLogger("webdashboardha.control")

router = APIRouter(prefix="/api", tags=["control"])


# Domains, die im Editor als Widgets wählbar sind.
_PICKER_DOMAINS = {
    "light",
    "switch",
    "input_boolean",
    "fan",
    "sensor",
    "binary_sensor",
    "weather",
    "media_player",
}


@router.get("/states")
async def get_states(hub: HubDep) -> dict[str, dict[str, Any]]:
    return hub.snapshot()


@router.get("/entities")
async def get_entities(hub: HubDep) -> list[dict[str, str]]:
    """Leichtgewichtige Liste für den Entity-Picker im Editor."""
    result: list[dict[str, str]] = []
    for entity_id, state in hub.snapshot().items():
        domain = entity_id.split(".")[0]
        if domain not in _PICKER_DOMAINS:
            continue
        attrs = state.get("attributes", {})
        result.append(
            {
                "entity_id": entity_id,
                "name": str(attrs.get("friendly_name", entity_id)),
                "domain": domain,
            }
        )
    result.sort(key=lambda e: (e["domain"], e["name"].lower()))
    return result


@router.post("/service")
async def call_service(payload: ServiceCall, hub: HubDep) -> dict[str, str]:
    if not hub.ha_connected:
        raise HTTPException(status_code=503, detail="HA nicht verbunden")
    try:
        await hub.call_service(
            payload.domain, payload.service, payload.entity_id, payload.data
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("call_service fehlgeschlagen: %s", exc)
        raise HTTPException(status_code=502, detail=f"HA-Fehler: {exc}") from exc
    return {"status": "ok"}


@router.post("/calendar")
async def fetch_calendar_events(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        config = normalize_calendar_config(payload)
        if not config["enabled"]:
            return {"provider": "google", "events": [], "enabled": False}
        events = fetch_google_events(config["calendarId"], config["apiKey"])
        return {"provider": "google", "enabled": True, "label": config["label"], "events": events}
    except Exception as exc:  # noqa: BLE001
        log.warning("Google-Kalenderabruf fehlgeschlagen: %s", exc)
        raise HTTPException(status_code=502, detail=f"Kalenderabruf fehlgeschlagen: {exc}") from exc
