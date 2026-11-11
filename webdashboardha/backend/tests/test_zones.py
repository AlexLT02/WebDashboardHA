"""ZoneStore: first start, seed merge without overwriting, rename, edits."""

from __future__ import annotations

import copy
import json

import pytest

from app.zones import ZoneError, ZoneStore
from conftest import FIXTURE_NOW


def _reload(tmp_path, seed):
    s = ZoneStore(tmp_path / "zones.json", seed, now=lambda: FIXTURE_NOW + 100)
    s.load()
    return s


def test_first_start_copies_seed(store, seed, tmp_path):
    raw = json.loads((tmp_path / "zones.json").read_text("utf-8"))
    assert raw["schema"] == 1 and raw["seed_version"] == seed["seed_version"]
    assert raw["items"] == seed["items"]
    assert raw["favorites"] == seed["favorites"]
    new_items = {k for k, v in seed["items"].items() if v.get("new")}
    assert set(raw["first_seen"]) == new_items
    assert all(v == int(FIXTURE_NOW) for v in raw["first_seen"].values())
    assert not (tmp_path / "zones.json.tmp").exists()  # atomic write cleaned up


def test_newer_seed_adds_missing_but_never_overwrites(store, seed, tmp_path):
    store.patch("light.alex_wohnung_eingangsbereich", {"name": "Flur", "zone": "kueche"})
    store.patch("climate.klima", {"zone": "pc"})
    del store.items["light.kuechenlicht_oben"]["func"]  # user-field missing locally
    store.save()

    seed2 = copy.deepcopy(seed)
    seed2["seed_version"] = seed["seed_version"] + 1
    seed2["items"]["light.alex_wohnung_eingangsbereich"]["name"] = "Eingang neu"
    seed2["items"]["light.alex_wohnung_eingangsbereich"]["kelvin_min"] = 2200
    seed2["items"]["light.kuechenlicht_oben"]["func"] = "ambiente"
    seed2["items"]["switch.neu"] = {"zone": "bad", "func": "medien", "name": "Neu", "new": True}

    s2 = _reload(tmp_path, seed2)
    eingang = s2.items["light.alex_wohnung_eingangsbereich"]
    assert eingang["name"] == "Flur" and eingang["zone"] == "kueche"  # Alex wins
    assert eingang["kelvin_min"] == 2200  # non-user field is added
    assert "func" not in s2.items["light.kuechenlicht_oben"]  # user field never re-added
    assert s2.items["switch.neu"]["name"] == "Neu"
    assert s2.items["climate.klima"]["zone"] == "pc"
    assert "switch.neu" in s2.first_seen
    assert s2.seed_version == seed2["seed_version"]


def test_seed_v2_brings_the_washer_to_a_v1_install(seed, tmp_path):
    """P4: an existing zones.json from seed v1 gets virtual.waesche (system) on the next start."""
    seed1 = copy.deepcopy(seed)
    seed1["seed_version"] = 1
    del seed1["items"]["virtual.waesche"]
    _reload(tmp_path, seed1)
    assert seed["seed_version"] >= 2
    s2 = _reload(tmp_path, seed)
    assert s2.items["virtual.waesche"]["system"] is True
    assert s2.items["virtual.waesche"]["name"] == "Wäsche"


def test_same_seed_version_does_not_merge(store, seed, tmp_path):
    store.reset("light.kuechenlicht_oben")
    del store.items["light.kuechenlicht_oben"]
    store.save()
    s2 = _reload(tmp_path, seed)
    assert "light.kuechenlicht_oben" not in s2.items


def test_rename_rekeys_items_favorites_first_seen_seen_and_seed(store, tmp_path, seed):
    old, new = "switch.alex_wohnung_monitore", "switch.monitore_neu"
    store.mark_seen(old)
    store.favorites.append({"id": old, "name": "Monitore"})
    assert store.rename(old, new)
    assert new in store.items and old not in store.items
    assert new in store.first_seen and old not in store.first_seen
    assert store.seen == [new]
    assert any(f["id"] == new for f in store.favorites)
    # Structure references in the seed follow, e.g. virtual.pc_platz members.
    assert new in store.seed["virtual"]["virtual.pc_platz"]["members"]
    s2 = _reload(tmp_path, seed)
    assert new in s2.items and s2.aliases == {old: new}


def test_rename_chain(store):
    store.rename("light.regal_alex_wohnung", "light.regal_b")
    store.rename("light.regal_b", "light.regal_c")
    assert store.aliases == {"light.regal_alex_wohnung": "light.regal_c", "light.regal_b": "light.regal_c"}
    assert "light.regal_c" in store.items


def test_rename_unknown_is_noop(store):
    assert store.rename("light.nirgends", "light.woanders") is False


@pytest.mark.parametrize("name", ["", "   ", "x" * 15, "Fünfzehn Zeiche"])
def test_name_validation(store, name):
    with pytest.raises(ZoneError):
        store.patch("light.regal_alex_wohnung", {"name": name})


def test_name_14_and_strip(store):
    store.patch("light.regal_alex_wohnung", {"name": "  Vierzehn Zeich  "[:18]})
    assert store.items["light.regal_alex_wohnung"]["name"] == "Vierzehn Zeich"


def test_name_null_restores_seed_name(store):
    store.patch("light.regal_alex_wohnung", {"name": "Bücher"})
    store.patch("light.regal_alex_wohnung", {"name": None})
    assert store.items["light.regal_alex_wohnung"]["name"] == "Regal"


def test_invalid_zone_tier_func(store):
    for change in ({"zone": "keller"}, {"tier": "oben"}, {"func": "x"}):
        with pytest.raises(ZoneError):
            store.patch("light.regal_alex_wohnung", change)


def test_assign_inbox_item_gets_func_name_order(store):
    store.patch("climate.klima", {"zone": "kueche"}, ha_name="Klimaanlage Alex Zimmer")
    item = store.items["climate.klima"]
    assert item["zone"] == "kueche" and item["func"] == "klima"
    assert item["name"] == "Klimaanlage Al"  # cut to 14
    assert item["order"] > max(v.get("order", 0) for k, v in store.items.items()
                               if v.get("zone") == "kueche" and k != "climate.klima")


def test_group_override_starts_from_seed_group(store):
    store.patch("light.zone_kueche", {"name": "Küchenlicht"})
    assert store.items["light.zone_kueche"] == {"zone": "kueche", "name": "Küchenlicht", "order": 10}
    store.reset("light.zone_kueche")
    assert "light.zone_kueche" not in store.items


def test_reset_restores_seed_or_removes(store, seed):
    store.patch("light.regal_alex_wohnung", {"zone": "bad", "tier": "hidden"})
    store.reset("light.regal_alex_wohnung")
    assert store.items["light.regal_alex_wohnung"] == seed["items"]["light.regal_alex_wohnung"]
    store.patch("cover.rollladen_alex", {"zone": "bett"})
    store.reset("cover.rollladen_alex")
    assert "cover.rollladen_alex" not in store.items


def test_order_step_swaps_neighbours(store):
    peers = ["light.a", "light.b", "light.c"]
    for p in peers:
        store.items[p] = {"zone": "bad", "func": "licht", "name": p}
    store.patch("light.b", {"order_step": -1}, section_peers=lambda _i: peers)
    assert [store.items[p]["order"] for p in ("light.b", "light.a", "light.c")] == [10, 20, 30]
    store.patch("light.c", {"order_step": 1}, section_peers=lambda _i: ["light.b", "light.a", "light.c"])
    assert store.items["light.c"]["order"] == 30  # already last, nothing moves


def test_favorites_max_15_and_unique(store):
    with pytest.raises(ZoneError):
        store.set_favorites([f"light.x{i}" for i in range(16)], {})
    with pytest.raises(ZoneError):
        store.set_favorites(["light.a", "light.a"], {})
    store.set_favorites(["light.zone_kueche", "light.regal_alex_wohnung"],
                        {"light.regal_alex_wohnung": "Regal lang und noch länger"})
    assert store.favorites == [
        {"id": "light.zone_kueche", "name": "Küche"},  # existing entry keeps its name
        {"id": "light.regal_alex_wohnung", "name": "Regal lang und"},
    ]


def test_seen(store):
    store.mark_seen("switch.alex_wohnung_monitore")
    store.mark_seen("switch.alex_wohnung_monitore")
    assert store.seen == ["switch.alex_wohnung_monitore"]
