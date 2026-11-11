"""REST + WS end to end with the real hub, a fake HA client and the fixture."""

from __future__ import annotations

import asyncio
import copy
import json
from contextlib import asynccontextmanager
from dataclasses import replace
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import load_settings
from app.hub import Hub
from app.routes import board, control, dashboards, ws
from app.storage import DashboardStore
from app.zones import ZoneStore, load_seed
from conftest import FIXTURE_NOW, FakeHA, load_registry_lists, load_states


def _make_app(data_dir: Path):
    settings = replace(load_settings(), data_dir=data_dir, ha_token="test")
    store = DashboardStore(data_dir)
    store.init()
    zones = ZoneStore(data_dir / "zones.json", load_seed(), now=lambda: FIXTURE_NOW)
    hub = Hub(settings, dashboards=store, zones=zones, ha_factory=FakeHA,
              wall=lambda: FIXTURE_NOW, rebuild_debounce_s=0.05)

    @asynccontextmanager
    async def lifespan(app):
        hub.zones.load()
        await hub.ha.connect(load_registry_lists(), load_states())
        yield
        await hub.stop()

    app = FastAPI(lifespan=lifespan)
    app.state.store = store
    app.state.hub = hub
    for r in (control.router, dashboards.router, board.router, ws.router):
        app.include_router(r)
    return app, hub


@pytest.fixture
def api(tmp_path):
    app, hub = _make_app(tmp_path)
    with TestClient(app) as client:
        yield client, hub


def test_board_endpoint(api):
    client, hub = api
    b = client.get("/api/board").json()
    assert b["rev"] == 1 and len(b["zones"]) == 5 and b["orphans"] == []
    assert len(b["inbox"]) == 6 and 140 <= b["watch_count"] <= 170
    # Registry loaded before states, via the four list commands.
    assert [c["type"] for c in hub.ha.commands][:4] == [
        "config/area_registry/list", "config/device_registry/list",
        "config/entity_registry/list", "config/label_registry/list"]
    assert "entity_registry_updated" in hub.ha.subscriptions


def test_v1_ws_still_full_stream(api):
    client, hub = api
    with client.websocket_connect("/ws") as sock:
        first = sock.receive_json()
        assert first["type"] == "snapshot" and len(first["states"]) == len(load_states())
        assert "last_changed" in next(iter(first["states"].values()))  # untouched HA states


def test_v2_ws_hello_board_snapshot_and_filtered_deltas(api):
    client, hub = api
    with client.websocket_connect("/ws?v=2") as sock:
        hello, brd, snap = sock.receive_json(), sock.receive_json(), sock.receive_json()
        assert hello == {"type": "hello", "version": "2.0.0", "ha_connected": True}
        assert brd["type"] == "board" and brd["rev"] == brd["board"]["rev"]
        assert snap["type"] == "snapshot"
        assert set(snap["states"]) <= hub.board.watch
        assert len(json.dumps(snap).encode()) <= 300_000
        sample = snap["states"]["light.alex_wohnung_eingangsbereich"]
        assert isinstance(sample["lc_ts"], int) and "last_changed" not in sample

        # an unwatched entity is not forwarded, a watched one is
        unwatched = copy.deepcopy(load_states()["sensor.alex_wohnung_luftwerte_kohlendioxid"])
        unwatched["entity_id"] = "sensor.nicht_beobachtet"
        hub._states["sensor.nicht_beobachtet"] = unwatched  # known entity, so no rebuild
        watched = copy.deepcopy(load_states()["light.regal_alex_wohnung"])
        watched["state"] = "off"
        client.portal.call(hub._on_state_change, "sensor.nicht_beobachtet", unwatched)
        client.portal.call(hub._on_state_change, "light.regal_alex_wohnung", watched)
        msg = sock.receive_json()  # the first message is the watched one
        assert msg["type"] == "state" and msg["entity_id"] == "light.regal_alex_wohnung"
        assert msg["state"]["state"] == "off"


def test_v2_power_sensor_throttled(api):
    client, hub = api
    eid = "sensor.alex_wohnung_monitore_leistung"
    base = load_states()[eid]
    assert base["attributes"]["device_class"] == "power"
    with client.websocket_connect("/ws?v=2") as sock:
        for _ in range(3):
            sock.receive_json()
        for value in ("100", "101", "102"):
            client.portal.call(hub._on_state_change, eid, {**base, "state": value})
        first = sock.receive_json()
        assert first["state"]["state"] == "100"
        assert set(hub._throttled) == {eid} and hub._throttled[eid]["state"] == "102"


def test_patch_name_15_rejected_14_ok(api):
    client, hub = api
    r = client.patch("/api/zones/items/light.regal_alex_wohnung", json={"name": "x" * 15})
    assert r.status_code == 422
    r = client.patch("/api/zones/items/light.regal_alex_wohnung", json={"name": "Bücherregal 14"})
    assert r.status_code == 200 and r.json()["rev"] == 2
    assert hub.board_json()["items"]["light.regal_alex_wohnung"]["name"] == "Bücherregal 14"


def test_patch_validation_and_unknown(api):
    client, _hub = api
    assert client.patch("/api/zones/items/light.nope", json={"zone": "bad"}).status_code == 404
    assert client.patch("/api/zones/items/climate.klima", json={"zone": "keller"}).status_code == 422
    assert client.patch("/api/zones/items/climate.klima", json={"tier": "oben"}).status_code == 422
    assert client.patch("/api/zones/items/climate.klima", json={"order_step": 2}).status_code == 422
    assert client.patch("/api/zones/items/climate.klima", json={"color": "red"}).status_code == 422


def test_inbox_assign_survives_restart(tmp_path):
    app, hub = _make_app(tmp_path)
    with TestClient(app) as client:
        r = client.patch("/api/zones/items/climate.klima", json={"zone": "kueche"})
        assert r.status_code == 200
        b = client.get("/api/board").json()
        assert "climate.klima" not in {i["id"] for i in b["inbox"]}
        kueche = next(z for z in b["zones"] if z["id"] == "kueche")
        assert "climate.klima" in [i for s in kueche["sections"] for i in s["items"]]
        assert b["items"]["climate.klima"]["new"] is True
    app2, _hub2 = _make_app(tmp_path)  # "restart": same /data
    with TestClient(app2) as client:
        b = client.get("/api/board").json()
        assert len(b["inbox"]) == 5
        assert b["items"]["climate.klima"]["zone"] == "kueche"


def test_hide_reset_seen_favorites(api):
    client, hub = api
    assert client.patch("/api/zones/items/light.regal_alex_wohnung", json={"tier": "hidden"}).status_code == 200
    b = client.get("/api/board").json()
    assert "light.regal_alex_wohnung" in b["hidden"]
    assert client.post("/api/zones/items/light.regal_alex_wohnung/reset").status_code == 200
    assert "light.regal_alex_wohnung" not in client.get("/api/board").json()["hidden"]

    assert client.get("/api/board").json()["items"]["switch.alex_wohnung_monitore"]["new"] is True
    assert client.post("/api/zones/items/switch.alex_wohnung_monitore/seen").status_code == 200
    assert client.get("/api/board").json()["items"]["switch.alex_wohnung_monitore"]["new"] is False

    r = client.put("/api/zones/favorites", json={"ids": ["light.zone_kueche", "climate.klima"]})
    assert r.status_code == 200
    b = client.get("/api/board").json()
    assert [f["id"] for f in b["start"]["favorites"]] == ["light.zone_kueche", "climate.klima"]
    assert "climate.klima" in {i["id"] for i in b["inbox"]}  # favorite, but still without zone
    assert client.put("/api/zones/favorites", json={"ids": ["light.nope"]}).status_code == 404
    too_many = [f"light.x{i}" for i in range(16)]
    assert client.put("/api/zones/favorites", json={"ids": too_many}).status_code == 422


def test_actions_endpoints(api):
    client, hub = api
    r = client.post("/api/actions/off", json={"scope": "alles_aus"})
    assert r.status_code == 200
    body = r.json()
    assert body["undo"] and body["count"] > 0 and body["expires_in"] == 10
    assert hub.ha.calls[-1][:3] == ("script", "turn_on", "script.alles_aus")
    assert client.post("/api/actions/undo", json={"undo": body["undo"]}).status_code == 200
    assert hub.ha.calls[-1][:3] == ("scene", "turn_on", "scene.wdh_undo")
    assert client.post("/api/actions/undo", json={"undo": body["undo"]}).status_code == 410
    assert client.post("/api/actions/off", json={"scope": "zone", "id": "keller"}).status_code == 404
    assert client.post("/api/actions/off", json={"scope": "alles"}).status_code == 422
    assert client.post("/api/actions/on", json={"scope": "ambiente"}).json()["count"] == 15
    hub.ha.fail_services.add("light.turn_off")
    assert client.post("/api/actions/off", json={"scope": "lights"}).status_code == 502


def test_actions_need_ha(api):
    client, hub = api
    client.portal.call(hub.ha.disconnect)
    assert client.post("/api/actions/off", json={"scope": "lights"}).status_code == 503
    assert client.get("/api/board").status_code == 200  # last board stays readable


def test_rename_in_ha_keeps_assignment(api):
    client, hub = api
    old, new = "switch.alex_wohnung_monitore", "switch.monitore"

    async def rename():
        st = hub._states.pop(old)
        hub._states[new] = {**st, "entity_id": new}
        await hub._on_event("entity_registry_updated",
                            {"action": "update", "entity_id": new, "old_entity_id": old, "changes": {}})
        hub.registry.cancel()
        await hub.rebuild()

    client.portal.call(rename)
    b = client.get("/api/board").json()
    assert b["items"][new]["zone"] == "pc" and b["items"][new]["name"] == "Monitore"
    assert new in b["items"]["virtual.pc_platz"]["members"]
    assert b["orphans"] == []


def test_registry_change_triggers_debounced_rebuild(api):
    client, hub = api
    rev = hub.rev
    lists = copy.deepcopy(load_registry_lists())
    for e in lists["entities"]:
        if e["entity_id"] == "input_boolean.lichtshow":
            e["labels"] = e["labels"] + ["dontshowindashboard"]
    hub.ha.registry_lists = lists

    async def fire():
        hub.registry._debounce_s = 0.05
        await hub._on_event("label_registry_updated", {"action": "update"})
        await asyncio.sleep(0.3)

    client.portal.call(fire)
    b = client.get("/api/board").json()
    assert hub.rev == rev + 1 and len(b["inbox"]) == 5
