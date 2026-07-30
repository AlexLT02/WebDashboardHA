"""Steuerungs- und State-Routen: /api/service, /api/states."""

from __future__ import annotations

import logging
import os
from typing import Any

import aiohttp
from fastapi import APIRouter, HTTPException

from ..config import load_settings
from ..dependencies import HubDep
from ..schemas import ServiceCall

log = logging.getLogger("webdashboardha.control")

router = APIRouter(prefix="/api", tags=["control"])

_settings = load_settings()
# Die Host-IP ändert sich praktisch nie — einmal ermitteln reicht.
_host_ip_cache: str | None = None


# Domains, die im Editor in der Vorschlagsliste auftauchen. Andere Entitäten
# lassen sich im Frontend weiterhin über die direkte Entity-ID-Eingabe anlegen.
_PICKER_DOMAINS = {
    "light",
    "switch",
    "input_boolean",
    "fan",
    "cover",
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


async def _supervisor_host_ip() -> str | None:
    """LAN-IP des HA-Hosts über die Supervisor-API.

    Die Container-IP (172.30.x.x) hilft dem iPad nicht — gebraucht wird die
    Adresse des Hosts, unter der der Kiosk-Port erreichbar ist. Im Dev-Modus
    (kein SUPERVISOR_TOKEN) gibt es sie nicht; dann fällt das Frontend auf den
    Hostnamen der aktuellen Seite zurück.
    """
    global _host_ip_cache
    if _host_ip_cache:
        return _host_ip_cache
    token = os.environ.get("SUPERVISOR_TOKEN")
    if not token:
        return None
    try:
        timeout = aiohttp.ClientTimeout(total=3)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(
                "http://supervisor/network/info",
                headers={"Authorization": f"Bearer {token}"},
            ) as resp:
                payload = await resp.json()
        interfaces = payload.get("data", {}).get("interfaces", [])
        # Primäres Interface bevorzugen, sonst das erste mit einer IPv4.
        for candidate in sorted(interfaces, key=lambda i: not i.get("primary")):
            addresses = (candidate.get("ipv4") or {}).get("address") or []
            if addresses:
                _host_ip_cache = str(addresses[0]).split("/")[0]
                return _host_ip_cache
    except Exception as exc:  # noqa: BLE001 — Anzeige-Komfort, nie kritisch
        log.info("Host-IP nicht ermittelbar: %s", exc)
    return None


@router.get("/hostinfo")
async def get_hostinfo() -> dict[str, Any]:
    """Adresse für den iPad-Kiosk (Anzeige im Einstellungs-Dialog)."""
    return {"host": await _supervisor_host_ip(), "port": _settings.port}


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
