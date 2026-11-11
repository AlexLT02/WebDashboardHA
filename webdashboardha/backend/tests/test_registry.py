"""Registry: loading via WS list commands, effective area, debounced reload, rename."""

from __future__ import annotations

import asyncio

from app.registry import LIST_COMMANDS, UPDATE_EVENTS, Registry
from conftest import FakeHA


def _lists():
    return {
        "areas": [{"area_id": "alex_wohnung", "name": "Alex Wohnung"}],
        "devices": [{"id": "d1", "area_id": "alex_wohnung", "name": "Plug", "model": "M", "manufacturer": "X"}],
        "entities": [
            {"entity_id": "switch.plug", "device_id": "d1", "area_id": None, "labels": ["strom"],
             "platform": "tuya", "extra_field": "ignored"},
            {"entity_id": "light.own_area", "device_id": "d1", "area_id": "bad", "labels": []},
            {"entity_id": "input_boolean.helper", "device_id": None, "area_id": None, "labels": []},
        ],
        "labels": [{"label_id": "strom", "name": "Strom"}],
    }


def test_load_uses_the_four_list_commands_and_keeps_needed_fields():
    fake = FakeHA("ws", "t")
    fake.registry_lists = _lists()
    reg = Registry()
    asyncio.run(reg.load(fake))
    assert [c["type"] for c in fake.commands] == list(LIST_COMMANDS.values())
    assert reg.loaded
    assert "extra_field" not in reg.entities["switch.plug"]
    assert reg.entities["switch.plug"]["platform"] == "tuya"


def test_effective_area_entity_wins_over_device():
    reg = Registry.from_lists(**_lists())
    assert reg.effective_area("switch.plug") == "alex_wohnung"  # from device
    assert reg.effective_area("light.own_area") == "bad"  # own area wins
    assert reg.effective_area("input_boolean.helper") is None
    assert reg.effective_area("light.unknown") is None
    assert reg.label_entities("strom") == ["switch.plug"]


def test_subscribes_all_registry_events():
    fake = FakeHA("ws", "t")
    asyncio.run(Registry().subscribe(fake))
    assert fake.subscriptions == list(UPDATE_EVENTS)


def test_event_burst_reloads_once_after_debounce():
    async def run():
        fake = FakeHA("ws", "t")
        fake.registry_lists = _lists()
        changes = []

        async def on_change():
            changes.append(1)

        reg = Registry(on_change=on_change, debounce_s=0.05)
        await reg.load(fake)
        fake.commands.clear()
        for _ in range(5):
            reg.handle_event("device_registry_updated", {"action": "update", "device_id": "d1"})
        await asyncio.sleep(0.15)
        return fake, changes

    fake, changes = asyncio.run(run())
    assert changes == [1]
    assert len(fake.commands) == 4  # exactly one reload


def test_rename_event_calls_back_immediately_and_rekeys():
    async def run():
        renames = []
        reg = Registry(on_rename=lambda o, n: renames.append((o, n)), debounce_s=10)
        reg.set_lists(**_lists())
        reg.handle_event("entity_registry_updated", {
            "action": "update", "entity_id": "switch.steckdose", "old_entity_id": "switch.plug",
            "changes": {"entity_id": "switch.plug"},
        })
        reg.cancel()
        return reg, renames

    reg, renames = asyncio.run(run())
    assert renames == [("switch.plug", "switch.steckdose")]
    assert "switch.steckdose" in reg.entities and "switch.plug" not in reg.entities
    assert reg.effective_area("switch.steckdose") == "alex_wohnung"


def test_other_events_are_ignored():
    reg = Registry(on_rename=lambda o, n: (_ for _ in ()).throw(AssertionError))
    reg.handle_event("state_changed", {})  # no task, no rename
    assert reg._reload_task is None
