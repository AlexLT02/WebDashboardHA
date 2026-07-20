from __future__ import annotations

import json
import os
import uuid
from typing import Any
from urllib.parse import urlencode


HTML_ESCAPE_MAP = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
}

_GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
_GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
_GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "").strip()


def _effective_redirect_uri(redirect_uri: str | None = None) -> str:
    return (redirect_uri or _GOOGLE_REDIRECT_URI or "http://localhost:8099/api/calendar/oauth/callback").strip()


def normalize_calendar_config(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    data = payload or {}
    calendar_id = str(data.get("calendarId") or data.get("calendar_id") or "primary").strip()
    label = str(data.get("label") or "Google Kalender").strip() or "Google Kalender"
    access_token = str(data.get("accessToken") or data.get("access_token") or "").strip()
    refresh_token = str(data.get("refreshToken") or data.get("refresh_token") or "").strip()
    return {
        "provider": "google",
        "enabled": True,
        "calendarId": calendar_id or "primary",
        "label": label,
        "accessToken": access_token,
        "refreshToken": refresh_token,
    }


def build_google_auth_url(redirect_uri: str | None = None) -> str:
    state = uuid.uuid4().hex
    params = urlencode(
        {
            "client_id": _GOOGLE_CLIENT_ID,
            "redirect_uri": _effective_redirect_uri(redirect_uri),
            "response_type": "code",
            "scope": "https://www.googleapis.com/auth/calendar.readonly",
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
    )
    return f"https://accounts.google.com/o/oauth2/v2/auth?{params}"


def build_google_events_url(calendar_id: str, access_token: str) -> str:
    base = f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events"
    params = urlencode({"access_token": access_token})
    return f"{base}?{params}"


def _escape_html(value: str) -> str:
    return "".join(HTML_ESCAPE_MAP.get(ch, ch) for ch in value)


def build_google_oauth_completion_page(access_token: str, refresh_token: str, calendars: list[dict[str, Any]]) -> str:
    payload = {
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "calendars": calendars,
    }
    json_payload = json.dumps(payload)
    return f"""<!DOCTYPE html>
<html lang=\"de\">
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>Google Kalender verbunden</title>
    <style>
      body {{ font-family: Arial, sans-serif; background: #07111f; color: #f8fafc; display: grid; place-items: center; min-height: 100vh; margin: 0; }}
      .card {{ background: #111827; border: 1px solid #334155; border-radius: 14px; padding: 24px; max-width: 420px; text-align: center; }}
      .btn {{ margin-top: 16px; background: #7dd3fc; color: #07111f; border: none; padding: 10px 14px; border-radius: 8px; font-weight: 700; cursor: pointer; }}
    </style>
  </head>
  <body>
    <div class=\"card\">
      <h2>Google Kalender verbunden</h2>
      <p>Die Verbindung wurde erfolgreich abgeschlossen. Du kannst dieses Fenster jetzt schließen.</p>
      <button class=\"btn\" onclick=\"window.close()\">Schließen</button>
    </div>
    <script>
      window.addEventListener('load', () => {{
        const payload = {json_payload};
        if (window.opener) {{
          window.opener.postMessage({{ type: 'google-calendar-auth', payload }}, window.location.origin);
        }}
        setTimeout(() => window.close(), 1000);
      }});
    </script>
  </body>
</html>"""


def fetch_google_events(calendar_id: str, access_token: str) -> list[dict[str, Any]]:
    import asyncio

    import aiohttp

    url = build_google_events_url(calendar_id, access_token)

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


def exchange_google_code(code: str, redirect_uri: str | None = None) -> dict[str, Any]:
    import asyncio

    import aiohttp

    payload = {
        "code": code,
        "client_id": _GOOGLE_CLIENT_ID,
        "client_secret": _GOOGLE_CLIENT_SECRET,
        "redirect_uri": _effective_redirect_uri(redirect_uri),
        "grant_type": "authorization_code",
    }

    async def _request() -> dict[str, Any]:
        timeout = aiohttp.ClientTimeout(total=20)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post("https://oauth2.googleapis.com/token", data=payload) as response:
                if response.status != 200:
                    raise RuntimeError(f"Google OAuth Fehler: {response.status}")
                return await response.json()

    return asyncio.run(_request())


def fetch_google_calendars(access_token: str) -> list[dict[str, Any]]:
    import asyncio

    import aiohttp

    url = "https://www.googleapis.com/calendar/v3/users/me/calendarList"

    async def _request() -> list[dict[str, Any]]:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url, headers={"Authorization": f"Bearer {access_token}"}) as response:
                if response.status != 200:
                    raise RuntimeError(f"Google Kalenderliste Fehler: {response.status}")
                payload = await response.json()
                items = payload.get("items") or []
                return [
                    {
                        "id": item.get("id"),
                        "summary": item.get("summary") or item.get("id"),
                        "primary": bool(item.get("primary")),
                    }
                    for item in items
                ]

    return asyncio.run(_request())
