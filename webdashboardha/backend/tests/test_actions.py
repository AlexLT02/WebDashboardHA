"""Bulk actions + undo against a recording fake (no HA)."""

from __future__ import annotations

import asyncio
import copy

import pytest

from app.actions import ActionError, ActionNotFound, ActionService, UndoExpired
from app.board import build_board
from conftest import FIXTURE_NOW


class Recorder:
    def __init__(self):
        self.calls = []
        self.fail = set()

    async def __call__(self, domain, service, entity_id, data):
        if f"{domain}.{service}" in self.fail:
            raise RuntimeError("boom")
        self.calls.append((domain, service, entity_id, data))


class Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


@pytest.fixture
def env(store, registry, states):
    rec, clock = Recorder(), Clock()
    svc = ActionService(rec, clock=clock)
    board = build_board(store.seed, store, registry, states, FIXTURE_NOW).data
    return SimpleEnv(svc, rec, clock, board, states, registry)


class SimpleEnv:
    def __init__(self, svc, rec, clock, board, states, registry):
        self.svc, self.rec, self.clock, self.board, self.states, self.registry = \
            svc, rec, clock, board, states, registry

    def off(self, scope, target=None, states=None):
        return asyncio.run(self.svc.off(scope, target, self.board, states or self.states, self.registry))


def _set(states, eid, value):
    states = copy.deepcopy(states)
    states[eid]["state"] = value
    return states


def test_alles_aus_snapshot_then_script(env):
    res = env.off("alles_aus")
    (d1, s1, e1, data), (d2, s2, e2, _) = env.rec.calls
    assert (d1, s1, e1) == ("scene", "create", None)
    assert data["scene_id"] == "wdh_undo"
    snap = data["snapshot_entities"]
    assert snap and res["count"] == len(snap)
    assert not [e for e in snap if e.startswith(("light.zone_", "media_player.", "virtual."))]
    assert all(env.states[e]["state"] == "on" for e in snap)
    # Hidden SONOFF relays are never snapshotted (restoring them fires the wall-switch automation).
    assert "switch.alex_zimmer_lichtschalter_eingang_alex_wohnung_deckenlicht_1_alex_wohnung" not in snap
    assert "input_boolean.ambilight" not in snap  # script.alles_aus does not touch input_boolean
    assert "switch.alex_wohnung_monitore" in snap  # label alles_aus
    assert (d2, s2, e2) == ("script", "turn_on", "script.alles_aus")
    assert res["undo"] == "u1" and res["expires_in"] == 10 and res["label"] == "Alles aus"
    assert res["partial"] is False  # TV is off in the fixture


def test_undo_restores_scene_once(env):
    res = env.off("alles_aus")
    env.clock.t += 9.9
    asyncio.run(env.svc.undo(res["undo"]))
    assert env.rec.calls[-1] == ("scene", "turn_on", "scene.wdh_undo", None)
    with pytest.raises(UndoExpired):  # one slot, used up
        asyncio.run(env.svc.undo(res["undo"]))


def test_undo_expires(env):
    res = env.off("alles_aus")
    env.clock.t += 10.1
    with pytest.raises(UndoExpired):
        asyncio.run(env.svc.undo(res["undo"]))


def test_undo_grace_for_other_scopes(env):
    res = env.off("lights")
    assert res["expires_in"] == 8
    env.clock.t += 12.5  # 8 s + 5 s grace
    asyncio.run(env.svc.undo(res["undo"]))


def test_new_action_replaces_slot(env):
    first = env.off("lights")
    second = env.off("ambiente")
    with pytest.raises(UndoExpired):
        asyncio.run(env.svc.undo(first["undo"]))
    asyncio.run(env.svc.undo(second["undo"]))


def test_empty_target_no_call(env):
    off_states = {k: ({**v, "state": "off"} if v["state"] == "on" else v) for k, v in env.states.items()}
    res = env.off("alles_aus", states=off_states)
    assert res["count"] == 0 and res["undo"] is None and env.rec.calls == []


def test_ambiente_off_spares_ipad_leiste(env):
    assert env.states["light.ipad_backlights"]["state"] == "on"
    res = env.off("ambiente")
    domain, service, ids, _ = env.rec.calls[-1]
    assert (domain, service) == ("homeassistant", "turn_off")
    assert "light.ipad_backlights" not in ids
    assert set(ids) <= set(env.board["start"]["kommen_gehen"][0]["count"])
    assert res["count"] == len(ids)


def test_ambiente_on_uses_full_action_set(env):
    res = asyncio.run(env.svc.on("ambiente", None, env.board))
    domain, service, ids, _ = env.rec.calls[-1]
    assert (domain, service) == ("homeassistant", "turn_on") and len(ids) == 15
    assert res["count"] == 15


def test_group_off_turns_members_off_not_group(env):
    res = env.off("group", "light.zone_hinten")
    domain, service, ids, _ = env.rec.calls[-1]
    assert (domain, service) == ("light", "turn_off")
    assert "light.zone_hinten" not in ids and ids
    assert all(env.states[e]["state"] == "on" for e in ids)
    assert res["label"] == "Licht hinten aus"


def test_switch_group_off_and_on(env):
    env.off("group", "virtual.pc_platz")
    assert env.rec.calls[-1][:2] == ("switch", "turn_off")
    asyncio.run(env.svc.on("group", "virtual.pc_platz", env.board))
    assert env.rec.calls[-1][:3] == ("switch", "turn_on", env.board["items"]["virtual.pc_platz"]["members"])


def test_group_on_targets_group_entity_with_night_brightness(env):
    asyncio.run(env.svc.on("group", "light.zone_kueche", env.board, brightness_pct=15))
    assert env.rec.calls[-1] == ("light", "turn_on", "light.zone_kueche", {"brightness_pct": 15})


def test_zone_off_splits_by_domain(env):
    states = _set(env.states, "input_boolean.ambilight", "on")
    states = _set(states, "light.regal_alex_wohnung", "on")
    asyncio.run(env.svc.off("zone", "wohnbereich", env.board, states, env.registry))
    services = [(d, s) for d, s, _e, _x in env.rec.calls]
    assert ("light", "turn_off") in services and ("input_boolean", "turn_off") in services
    lights = next(e for d, s, e, _x in env.rec.calls if (d, s) == ("light", "turn_off"))
    assert "light.ipad_backlights" not in lights


def test_partial_and_hint(env):
    states = _set(env.states, "media_player.alex_wohnung_alex_tv_wohnbereich", "on")
    for c in ("binary_sensor.alex_wohnung_fenster_bad_alex_wohnung_fenster_bad",
              "binary_sensor.alex_wohnung_kuhlschranktur_tur", "binary_sensor.alex_wohnung_einganstur_tur"):
        states = _set(states, c, "on")
    res = asyncio.run(env.svc.off("alles_aus", None, env.board, states, env.registry))
    assert res["partial"] is True
    assert res["hint"] == "Eingangstür, Fenster Bad +1 offen"


def test_snapshot_failure_still_switches_off(env):
    env.rec.fail.add("scene.create")
    res = env.off("lights")
    assert res["undo"] is None and env.rec.calls[-1][:2] == ("light", "turn_off")


def test_execution_failure_raises_and_leaves_no_undo(env):
    env.rec.fail.add("script.turn_on")
    with pytest.raises(RuntimeError):
        env.off("alles_aus")
    with pytest.raises(UndoExpired):
        asyncio.run(env.svc.undo("u1"))


def test_unknown_scope_and_ids(env):
    with pytest.raises(ActionError):
        env.off("everything")
    with pytest.raises(ActionNotFound):
        env.off("zone", "keller")
    with pytest.raises(ActionNotFound):
        env.off("group", "light.alex_wohnung_eingangsbereich")  # not a group
    with pytest.raises(ActionError):
        asyncio.run(env.svc.on("lights", None, env.board))
