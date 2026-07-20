from __future__ import annotations

from typing import Any
from urllib.parse import urlencode


def normalize_calendar_config(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    data = payload or {}
    calendar_id = str(data.get("calendarId") or data.get("calendar_id") or "primary").strip()
    label = str(data.get("label") or "Google Kalender").strip() or "Google Kalender"
    api_key = str(data.get("apiKey") or data.get("api_key") or "").strip()
    return {
        "provider": "google",
        "enabled": True,
        "calendarId": calendar_id or "primary",
        "label": label,
        "apiKey": api_key,
    }


def build_google_events_url(calendar_id: str, api_key: str) -> str:
    base = f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events"
    params = urlencode({"key": api_key}) if api_key else {}
    return f"{base}?{params}" if params else base


def fetch_google_events(calendar_id: str, api_key: str) -> list[dict[str, Any]]:
    import asyncio

    import aiohttp

    url = build_google_events_url(calendar_id, api_key)
    async def _request() -> list[dict[str, Any]]:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url) as response:
                if response.status != 200:
                    raise RuntimeError(f"Google Calendar API Fehler: {response.status}")
                payload = await response.json()
                items = payload.get("items") or []
                return [
                    {
                        "id": item.get("id"),
                        "summary": item.get("summary") or "Ohne Titel",
                        "start": item.get("start", {}),
                        "end": item.get("end", {}),
                        "htmlLink": item.get("htmlLink"),
                    }
                    for item in items
                ]

    return asyncio.run(_request())
