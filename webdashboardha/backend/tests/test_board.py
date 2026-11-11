"""build_board: realistic fixture (HA 2026-11-11) + one test per filter rule."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.board import build_board, slim_state, suggest_zone
from app.registry import Registry
from conftest import FIXTURE_NOW


def _build(seed, store, registry, states, settings=None):
    return build_board(store.seed, store, registry, states, FIXTURE_NOW, settings)


def _tile_ids(zone):
    return [i for s in zone["sections"] for i in s["items"]] + zone["all_only"]


# ---- realistic fixture: the P1 numbers -----------------------------------------------


def test_zone_tile_counts(seed, store, registry, states):
    data = _build(seed, store, registry, states).data
    counts = {z["id"]: len(_tile_ids(z)) for z in data["zones"]}
    assert counts == {"wohnbereich": 18, "kueche": 4, "pc": 8, "bett": 9, "bad": 5}


def test_seed_icons_reach_items_and_chips(seed, store, registry, states):
    """P2: chip/favourite groups and LED strips carry the mockup icons (seed `icon`)."""
    items = _build(seed, store, registry, states).data["items"]
    assert items["light.zone_tv"]["icon"] == "strip"
    assert items["light.zone_bad"]["icon"] == "bath"
    assert items["light.zone_sofa_deckenlicht"]["icon"] == "ceiling"
    assert items["virtual.pc_platz"]["icon"] == "monitor"
    assert items["light.regal_alex_wohnung"]["icon"] == "strip"
    assert items["light.sofa_alex"]["icon"] == "lamp"  # default for func ambiente


def test_sections_in_order_and_hidden_excluded(seed, store, registry, states):
    data = _build(seed, store, registry, states).data
    wb = data["zones"][0]
    assert [s["id"] for s in wb["sections"]] == ["licht", "ambiente", "medien", "klima"]
    assert wb["sections"][0]["items"][:3] == [
        "light.alex_wohnung_eingangsbereich", "light.alex_wohnung_wohnbereich_links",
        "light.alex_wohnung_wohnbereich_rechts",
    ]
    assert wb["all_only"] == ["light.ipad_backlights"]
    assert "media_player.alex_wohnung_echo_dot" not in _tile_ids(wb)
    assert [s["id"] for s in data["zones"][1]["sections"]] == ["licht", "ambiente", "medien"]


def test_groups_favorites_orphans(seed, store, registry, states):
    data = _build(seed, store, registry, states).data
    chips = [c for z in data["zones"] for c in z["chips"]]
    assert len(chips) == 8 and "virtual.pc_platz" in chips
    assert len(data["start"]["favorites"]) == 15
    assert data["orphans"] == []


def test_inbox_is_exactly_expected(seed, store, registry, states):
    board = _build(seed, store, registry, states)
    inbox = {i["id"] for i in board.data["inbox"]}
    assert inbox == {e["id"] for e in seed["expected_inbox"]}
    assert set(board.first_seen_new) == inbox - set(store.first_seen)
    klima = next(i for i in board.data["inbox"] if i["id"] == "climate.klima")
    assert klima["area"] == "alex_zimmer" and klima["suggest"] is None
    pc2 = next(i for i in board.data["inbox"] if i["id"] == "switch.pc_2_strom_steckdose_1")
    assert pc2["suggest"] == "pc" and pc2["name"] == "PC 2"
    assert board.data["items"]["climate.klima"]["zone"] is None


def test_kommen_gehen_ambiente_sets(seed, store, registry, states):
    kg = _build(seed, store, registry, states).data["start"]["kommen_gehen"]
    amb = kg[0]
    assert amb["role"] == "ambiente"
    assert len(amb["action"]) == 15 and len(amb["count"]) == 13
    assert "light.ipad_backlights" in amb["action"]
    assert "light.ipad_backlights" not in amb["count"]
    assert not [e for e in amb["count"] if e.startswith("switch.")]
    wohnlicht = kg[1]
    assert wohnlicht["id"] == "light.zone_wohnlicht" and len(wohnlicht["members"]) == 6


def test_watch_set_and_snapshot_size(seed, store, registry, states):
    board = _build(seed, store, registry, states)
    assert 140 <= board.data["watch_count"] <= 170
    assert board.data["watch_count"] == len(board.watch)
    # alert helpers + virtual parts + facts are watched
    for eid in ("input_text.wdh_slot_4", "sensor.alex_wohnung_spulmaschiene_zustand",
                "sensor.raumtemperatur_wohnbereich", "wdh.forecast_today", "timer.heizung_bad_boost",
                "media_player.alex_wohnung_echo", "light.schrank_ambiente"):
        assert eid in board.watch, eid
    assert not any(e.startswith("virtual.") for e in board.watch)
    snap = {e: slim_state(states[e]) for e in board.watch if e in states}
    assert len(json.dumps(snap, ensure_ascii=False).encode()) <= 300_000


def test_watch_follows_alert_settings(seed, store, registry, states):
    board = _build(seed, store, registry, states, {"alertSlotPrefix": "", "alertIndexEntity": "input_number.x"})
    assert "input_text.wdh_slot_1" not in board.watch and "input_number.x" in board.watch


def test_light_targets(seed, store, registry, states):
    zones = {z["id"]: z for z in _build(seed, store, registry, states).data["zones"]}
    wb = zones["wohnbereich"]["light_targets"]
    assert "input_boolean.ambilight" in wb
    assert "light.ipad_backlights" not in wb  # count: false
    assert not [e for e in wb if e.startswith("light.zone_")]
    assert "light.alex_wohnung_kleiderschrank_licht_rechts" in zones["bett"]["light_targets"]  # tier all


def test_group_members_without_count_false(seed, store, registry, states):
    items = _build(seed, store, registry, states).data["items"]
    sofa = items["light.zone_ambiente_sofa"]
    assert sofa["kind"] == "group" and sofa["count"] is False
    assert len(states["light.zone_ambiente_sofa"]["attributes"]["entity_id"]) == 8
    assert len(sofa["members"]) == 7 and "light.ipad_backlights" not in sofa["members"]
    assert items["virtual.pc_platz"]["kind"] == "switch_group"
    assert len(items["virtual.pc_platz"]["members"]) == 3


def test_kinds_features_cloud(seed, store, registry, states):
    items = _build(seed, store, registry, states).data["items"]
    assert items["light.ambiente_ecklampe"]["features"]["ct"][0] == 2000  # kelvin_min clamp
    assert states["light.ambiente_ecklampe"]["attributes"]["min_color_temp_kelvin"] < 2000
    assert items["light.ipad_backlights"]["kind"] == "status_led"
    assert items["switch.pc_2_strom_steckdose_1"]["kind"] == "switch_critical"
    assert items["cover.rollladen_alex"]["kind"] == "cover_pos"
    assert items["cover.rolladen_treppe_alex_wohnung"]["kind"] == "cover"
    assert items["climate.thermostat_wohnbereich_alex"]["kind"] == "climate_tuya"
    assert items["climate.klima"]["kind"] == "climate"
    assert items["media_player.alex_wohnung_firetv_stick_bett_alex"]["kind"] == "media"
    assert items["virtual.fernsehen"]["kind"] == "tv"
    assert items["virtual.fernsehen"]["primary"].startswith("media_player.")
    assert items["virtual.spuelmaschine"]["kind"] == "appliance"
    assert items["input_boolean.multiroom"]["kind"] == "multiroom"
    assert items["input_boolean.multiroom"]["zone"] is None
    assert items["switch.mischpult_alex_steckdose_1"]["cloud"] is True  # tuya
    assert items["light.alex_wohnung_eingangsbereich"]["cloud"] is False  # matter
    assert items["light.zone_kueche"]["count"] is False
    assert items["virtual.fernsehen"]["count"] is False
    assert items["switch.alex_wohnung_monitore"]["new"] is True
    assert items["switch.alex_wohnung_monitore"]["power"] == "sensor.alex_wohnung_monitore_leistung"


def test_washer_is_a_system_appliance(seed, store, registry, states):
    """P4 (D18): the washing machine is an item for the Lage popup, never a zone tile or inbox entry."""
    board = _build(seed, store, registry, states)
    data = board.data
    w = data["items"]["virtual.waesche"]
    assert w["kind"] == "appliance" and w["system"] is True and w["zone"] is None
    assert w["name"] == "Wäsche" and w["icon"] == "washer" and w["count"] is False
    assert w["state"] == "sensor.waschmaschiene_alex_zustand"
    assert w["unload_button"].startswith("button.") and "power" not in w
    assert "virtual.waesche" not in {i["id"] for i in data["inbox"]}
    assert "virtual.waesche" not in {i for z in data["zones"] for i in _tile_ids(z) + z["chips"]}
    lage = next(b for b in data["start"]["lage"] if b["key"] == "waesche")
    assert lage["virtual"] == "virtual.waesche"
    for eid in ("sensor.waschmaschiene_alex_zustand", "sensor.waschmaschiene_alex_verbleibende_zeit",
                "button.alex_wohnung_waschmaschiene_alex_als_entladen_markieren"):
        assert eid in board.watch, eid


def test_washer_orphaned_when_sensor_missing(seed, store, registry, states):
    states = {k: v for k, v in states.items() if k != "sensor.waschmaschiene_alex_zustand"}
    data = _build(seed, store, registry, states).data
    assert "virtual.waesche" not in data["items"]
    assert {"id": "sensor.waschmaschiene_alex_zustand", "where": "virtual.waesche"} in data["orphans"]


# ---- filter chain, one rule per test (synthetic) -------------------------------------


def _mini_seed(items=None, groups=None, favorites=None):
    return {
        "scope_areas": ["home"],
        "zones": [{"id": "z", "name": "Zone"}],
        "sections": [{"id": s, "name": s} for s in ("licht", "ambiente", "medien", "klima")],
        "items": items or {}, "groups": groups or [], "favorites": favorites or [],
        "virtual": {}, "kommen_gehen": [], "lage": [],
    }


def _st(eid, state="off", **attrs):
    return {"entity_id": eid, "state": state, "attributes": attrs,
            "last_changed": "2026-11-11T10:00:00.123456+00:00"}


def _ent(eid, device=None, **kw):
    return {"entity_id": eid, "device_id": device, "area_id": kw.pop("area", "home"), "labels": [], **kw}


def _mini(entities, states, items=None, devices=None, **seed_kw):
    seed = _mini_seed(items, **seed_kw)
    reg = Registry.from_lists(areas=[{"area_id": "home"}], devices=devices or [], entities=entities, labels=[])
    store = SimpleNamespace(items=seed["items"], favorites=seed["favorites"], first_seen={}, seen=[])
    return build_board(seed, store, reg, {s["entity_id"]: s for s in states}, FIXTURE_NOW)


def _inbox(board):
    return [i["id"] for i in board.data["inbox"]]


def test_rule1_no_state_or_disabled():
    b = _mini([_ent("light.nostate"), _ent("light.disabled", disabled_by="user"), _ent("light.ok")],
              [_st("light.disabled"), _st("light.ok")])
    assert _inbox(b) == ["light.ok"]


def test_rule1_explicit_missing_is_orphan():
    b = _mini([_ent("light.gone", disabled_by="device")], [_st("light.gone")],
              items={"light.gone": {"zone": "z", "name": "Weg"}, "light.never": {"zone": "z", "name": "Nie"}},
              favorites=[{"id": "light.never", "name": "Nie"}])
    assert {(o["id"], o["where"]) for o in b.data["orphans"]} == {
        ("light.gone", "items"), ("light.never", "items"), ("light.never", "favorites")}
    assert "light.gone" not in b.data["items"]


def test_rule2_hidden():
    b = _mini([_ent("light.h", hidden_by="user")], [_st("light.h")])
    assert _inbox(b) == []


def test_rule3_entity_category():
    b = _mini([_ent("switch.lock", entity_category="config")], [_st("switch.lock")])
    assert _inbox(b) == []


def test_rule4_label():
    b = _mini([_ent("light.l", labels=["dontshowindashboard"])], [_st("light.l")])
    assert _inbox(b) == []


def test_rule5_domain():
    b = _mini([_ent("sensor.t"), _ent("binary_sensor.d"), _ent("fan.f")],
              [_st("sensor.t", "21"), _st("binary_sensor.d"), _st("fan.f")])
    assert _inbox(b) == ["fan.f"]


def test_rule6_one_device_one_tile_cover_beats_light():
    ents = [_ent("cover.r", "d1"), _ent("light.r_backlight", "d1"), _ent("switch.r_child", "d1"),
            _ent("light.a", "d2"), _ent("light.b", "d2"), _ent("switch.c", "d2")]
    sts = [_st(e["entity_id"]) for e in ents]
    assert sorted(_inbox(_mini(ents, sts))) == ["cover.r", "light.a", "light.b"]


def test_rule6_explicit_entries_do_not_compete():
    ents = [_ent("cover.r", "d1"), _ent("light.r_backlight", "d1")]
    b = _mini(ents, [_st("cover.r"), _st("light.r_backlight")],
              items={"cover.r": {"zone": "z", "func": "klima", "name": "Rollo"}})
    assert _inbox(b) == ["light.r_backlight"]


def test_explicit_wins_over_rules_2_to_5():
    ents = [_ent("light.g", hidden_by="user", labels=["dontshowindashboard"], entity_category="config"),
            _ent("sensor.x", area="elsewhere")]
    b = _mini(ents, [_st("light.g", entity_id=["light.m"]), _st("light.m"), _st("sensor.x", "1")],
              groups=[{"id": "light.g", "zone": "z", "name": "G", "order": 1}],
              items={"sensor.x": {"zone": "z", "func": "medien", "name": "X"}})
    zone = b.data["zones"][0]
    assert zone["chips"] == ["light.g"] and "sensor.x" in _tile_ids(zone)


def test_rule7_out_of_scope_area_ignored():
    b = _mini([_ent("light.far", area="garage"), _ent("light.near")], [_st("light.far"), _st("light.near")])
    assert _inbox(b) == ["light.near"]
    assert b.first_seen_new == {"light.near": int(FIXTURE_NOW)}


def test_rule8_zone_null_to_inbox_but_not_hidden_or_system():
    items = {"switch.a": {"zone": None, "name": "A"}, "switch.b": {"zone": None, "tier": "hidden"},
             "input_boolean.s": {"system": True, "name": "S"}}
    b = _mini([], [_st("switch.a"), _st("switch.b"), _st("input_boolean.s")], items=items)
    assert _inbox(b) == ["switch.a"]
    assert b.data["hidden"] == ["switch.b"]


def test_kind_derivation():
    sts = [_st("light.grp", entity_id=["light.x"]), _st("light.x", supported_color_modes=["onoff"]),
           _st("light.dim", supported_color_modes=["brightness"]), _st("cover.pos", supported_features=15),
           _st("cover.plain", supported_features=11), _st("fan.f"), _st("vacuum.v"), _st("media_player.m"),
           _st("climate.c"), _st("input_boolean.i"), _st("switch.k")]
    items = {s["entity_id"]: {"zone": "z", "name": "n"} for s in sts}
    items["switch.k"]["critical"] = True
    kinds = {k: v["kind"] for k, v in _mini([], sts, items=items).data["items"].items()}
    assert kinds == {"light.grp": "group", "light.x": "light_onoff", "light.dim": "light",
                     "cover.pos": "cover_pos", "cover.plain": "cover", "fan.f": "switch",
                     "vacuum.v": "vacuum", "media_player.m": "media", "climate.c": "climate",
                     "input_boolean.i": "input_boolean", "switch.k": "switch_critical"}


def test_cloud_flag():
    ents = [_ent("light.t", platform="tuya"), _ent("light.g", platform="mqtt", unique_id="gv2mqtt-AB"),
            _ent("light.z", platform="mqtt", unique_id="0x00158d_light"), _ent("light.a", platform="alexa_devices")]
    b = _mini(ents, [_st(e["entity_id"]) for e in ents])
    assert {k: v["cloud"] for k, v in b.data["items"].items()} == {
        "light.t": True, "light.g": True, "light.z": False, "light.a": True}


@pytest.mark.parametrize("name,zone", [
    ("Kühlschrank Licht", "kueche"), ("Badspiegel", "bad"), ("Kleiderschrank Ambiente", "bett"),
    ("PC 2 Strom", "pc"), ("TV Lowboard", "wohnbereich"), ("Klima", None),
])
def test_suggest_keywords(name, zone):
    assert suggest_zone(name) == zone


def test_slim_state_diet_and_timestamps():
    vac = {"entity_id": "vacuum.dreame", "state": "docked",
           "attributes": {"friendly_name": "D", "battery": 90, **{f"x{i}": i for i in range(250)}},
           "last_changed": "2026-11-11T10:00:00.123456+00:00"}
    out = slim_state(vac)
    assert set(out["attributes"]) == {"friendly_name", "battery"}
    expected = datetime(2026, 11, 11, 10, 0, 0, 123456, tzinfo=timezone.utc).timestamp()
    assert out["lc_ts"] == int(expected * 1000)
    mp = slim_state({"entity_id": "media_player.x", "state": "playing", "last_changed": "",
                     "attributes": {"entity_picture": "/a", "media_image_url": "u", "media_title": "t"}})
    assert mp["attributes"] == {"media_title": "t"} and mp["lc_ts"] is None
    timer = slim_state({"entity_id": "timer.t", "state": "active", "last_changed": "2026-11-11T10:00:00+00:00",
                        "attributes": {"finishes_at": "2026-11-11T10:30:00+00:00"}})
    assert timer["finishes_ts"] - timer["lc_ts"] == 30 * 60 * 1000
    assert "last_updated" not in out and "context" not in out
