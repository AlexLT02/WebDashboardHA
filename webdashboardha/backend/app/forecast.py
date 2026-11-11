"""Today's forecast as the virtual state ``wdh.forecast_today`` (04 §4.1, P3).

HA has no forecast attributes on weather entities any more; the range "heute
6° bis 12°" needs ``weather.get_forecasts`` (daily, with response). Polled every
30 min and after every (re)connect. Nothing is written to HA.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from .board import FORECAST_ID

log = logging.getLogger("webdashboardha.forecast")

INTERVAL_S = 30 * 60
RETRY_S = 5 * 60

# (domain, service, entity_id, service_data) -> full WS result message
ServiceCaller = Callable[..., Awaitable[dict[str, Any]]]


def pick_today(forecast: list[dict[str, Any]], now: datetime) -> dict[str, Any] | None:
    """The entry for today's (local) date, else the first one that is not in the past."""
    today = now.date()
    later = None
    for entry in forecast:
        raw = entry.get("datetime")
        try:
            when = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except ValueError:
            continue
        local = when.astimezone(now.tzinfo) if when.tzinfo and now.tzinfo else when
        if local.date() == today:
            return entry
        if later is None and local.date() > today:
            later = entry
    return later or (forecast[0] if forecast else None)


def forecast_state(entry: dict[str, Any], now: datetime) -> dict[str, Any]:
    attrs: dict[str, Any] = {"friendly_name": "Vorhersage heute"}
    for key in ("temperature", "templow", "condition", "precipitation", "precipitation_probability"):
        if entry.get(key) is not None:
            attrs[key] = entry[key]
    return {
        "entity_id": FORECAST_ID,
        "state": str(entry.get("condition") or "unknown"),
        "attributes": attrs,
        "last_changed": now.astimezone(timezone.utc).isoformat(),
    }


def parse_response(result: dict[str, Any], weather_entity: str) -> list[dict[str, Any]]:
    """Forecast list from a call_service result (``result.response.<entity>.forecast``)."""
    response = (result.get("result") or {}).get("response") or result.get("response") or {}
    return list(((response.get(weather_entity) or {}).get("forecast")) or [])


class ForecastService:
    def __init__(
        self,
        call: ServiceCaller,
        publish: Callable[[str, dict[str, Any]], Awaitable[None]],
        weather_entity: str,
        *,
        now: Callable[[], datetime] = lambda: datetime.now().astimezone(),
        interval_s: float = INTERVAL_S,
        retry_s: float = RETRY_S,
    ) -> None:
        self._call = call
        self._publish = publish
        self._entity = weather_entity
        self._now = now
        self._interval = interval_s
        self._retry = retry_s
        self._task: asyncio.Task[None] | None = None
        self.last: dict[str, Any] | None = None

    async def refresh(self) -> dict[str, Any] | None:
        result = await self._call("weather", "get_forecasts", self._entity, {"type": "daily"})
        now = self._now()
        entry = pick_today(parse_response(result, self._entity), now)
        if entry is None:
            log.info("Keine Tagesvorhersage für %s.", self._entity)
            return None
        state = forecast_state(entry, now)
        self.last = state
        await self._publish(FORECAST_ID, state)
        return state

    async def _loop(self) -> None:
        while True:
            try:
                ok = await self.refresh() is not None
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 — the header just omits the range
                log.warning("Vorhersage nicht abrufbar: %s", exc)
                ok = False
            await asyncio.sleep(self._interval if ok else self._retry)

    def kick(self) -> None:
        """(Re)start polling now, e.g. after HA (re)connected."""
        self.cancel()
        self._task = asyncio.create_task(self._loop())

    def cancel(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
        self._task = None
