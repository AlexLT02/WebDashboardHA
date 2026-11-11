"""forecast.py (P3): daily forecast -> virtual state wdh.forecast_today."""

from __future__ import annotations

import asyncio
from dataclasses import replace
from datetime import datetime, timedelta, timezone

from app.config import load_settings
from app.forecast import ForecastService, forecast_state, parse_response, pick_today
from app.hub import Hub
from app.zones import ZoneStore, load_seed
from conftest import FIXTURE_NOW, FakeHA, load_registry_lists, load_states

CET = timezone(timedelta(hours=1))
NOW = datetime(2026, 11, 11, 14, 12, tzinfo=CET)

FORECAST = [
    {"datetime": "2026-11-10T11:00:00+00:00", "condition": "rainy", "temperature": 9.0, "templow": 4.0},
    {"datetime": "2026-11-11T11:00:00+00:00", "condition": "cloudy", "temperature": 12.3, "templow": 6.1,
     "precipitation": 0.4},
    {"datetime": "2026-11-12T11:00:00+00:00", "condition": "sunny", "temperature": 14.0, "templow": 7.0},
]


def _result(entity="weather.forecast_home", forecast=FORECAST):
    # Shape of a HA WS result for call_service with return_response.
    return {"id": 7, "type": "result", "success": True,
            "result": {"context": {"id": "x"}, "response": {entity: {"forecast": forecast}}}}


def test_pick_today_by_local_date():
    assert pick_today(FORECAST, NOW)["condition"] == "cloudy"
    # Evening provider that already starts with tomorrow: take the next future entry.
    assert pick_today(FORECAST[2:], NOW)["condition"] == "sunny"
    assert pick_today([], NOW) is None
    assert pick_today([{"datetime": "kaputt", "condition": "fog"}], NOW)["condition"] == "fog"


def test_parse_response_and_state():
    entries = parse_response(_result(), "weather.forecast_home")
    assert len(entries) == 3
    assert parse_response({"success": True}, "weather.forecast_home") == []
    st = forecast_state(entries[1], NOW)
    assert st["entity_id"] == "wdh.forecast_today" and st["state"] == "cloudy"
    assert st["attributes"]["temperature"] == 12.3 and st["attributes"]["templow"] == 6.1
    assert st["last_changed"].endswith("+00:00")


def test_refresh_calls_daily_forecast_and_publishes():
    calls, published = [], []

    async def call(domain, service, entity_id, data):
        calls.append((domain, service, entity_id, data))
        return _result()

    async def publish(eid, state):
        published.append((eid, state))

    svc = ForecastService(call, publish, "weather.forecast_home", now=lambda: NOW)
    state = asyncio.run(svc.refresh())
    assert calls == [("weather", "get_forecasts", "weather.forecast_home", {"type": "daily"})]
    assert published == [("wdh.forecast_today", state)] and state["attributes"]["templow"] == 6.1


def test_refresh_without_forecast_publishes_nothing():
    async def call(*_a):
        return _result(forecast=[])

    published = []

    async def publish(eid, state):
        published.append(eid)

    assert asyncio.run(ForecastService(call, publish, "weather.forecast_home").refresh()) is None
    assert published == []


class ForecastHA(FakeHA):
    async def call_service(self, domain, service, *, entity_id=None, service_data=None, return_response=False):
        await super().call_service(domain, service, entity_id=entity_id, service_data=service_data)
        if (domain, service) == ("weather", "get_forecasts"):
            assert return_response is True
            return _result()
        return {"success": True}


def test_hub_publishes_forecast_into_v2_stream(tmp_path):
    settings = replace(load_settings(), data_dir=tmp_path, ha_token="test")
    zones = ZoneStore(tmp_path / "zones.json", load_seed(), now=lambda: FIXTURE_NOW)
    hub = Hub(settings, zones=zones, ha_factory=ForecastHA, wall=lambda: FIXTURE_NOW, rebuild_debounce_s=0.05)

    async def run():
        hub.zones.load()
        sent = []

        async def capture(msg):
            sent.append(msg)

        hub._broadcast_v2 = capture  # type: ignore[method-assign]
        await hub.ha.connect(load_registry_lists(), load_states())
        for _ in range(20):
            await asyncio.sleep(0.01)
            if any(m.get("entity_id") == "wdh.forecast_today" for m in sent):
                break
        await hub.stop()
        return sent

    sent = asyncio.run(run())
    assert ("weather", "get_forecasts", "weather.forecast_home", {"type": "daily"}) in hub.ha.calls
    msg = next(m for m in sent if m.get("entity_id") == "wdh.forecast_today")
    assert msg["type"] == "state" and msg["state"]["attributes"]["templow"] in (4.0, 6.1, 7.0)
    assert isinstance(msg["state"]["lc_ts"], int)
    assert "wdh.forecast_today" in hub.v2_snapshot()
