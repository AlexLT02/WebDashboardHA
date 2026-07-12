"""Steuerungs- und State-Routen: /api/service, /api/states."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException

from ..dependencies import HubDep
from ..schemas import ServiceCall

log = logging.getLogger("webdashboardha.control")

router = APIRouter(prefix="/api", tags=["control"])


@router.get("/states")
async def get_states(hub: HubDep) -> dict[str, dict[str, Any]]:
    return hub.snapshot()


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
