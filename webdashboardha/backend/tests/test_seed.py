"""Seed (Startbelegung) loads and every shown name fits the tile (<= 14)."""

from app.zones import NAME_MAX, SEED_PATH, load_seed


def test_seed_loads_from_app_folder():
    assert SEED_PATH.parent.name == "seed"  # not "data" (.dockerignore excludes data)
    seed = load_seed()
    assert seed["schema"] == 1 and seed["seed_version"] >= 1
    assert [z["id"] for z in seed["zones"]] == ["wohnbereich", "kueche", "pc", "bett", "bad"]
    assert len(seed["expected_inbox"]) == 6


def test_all_names_at_most_14():
    seed = load_seed()
    names = [(i, v["name"]) for i, v in seed["items"].items() if "name" in v]
    names += [(g["id"], g["name"]) for g in seed["groups"]]
    names += [(f["id"], f["name"]) for f in seed["favorites"]]
    names += [(k.get("id", k["role"]), k["name"]) for k in seed["kommen_gehen"]]
    names += [(z["id"], z["name"]) for z in seed["zones"]]
    too_long = [(i, n) for i, n in names if not 1 <= len(n) <= NAME_MAX]
    assert too_long == []
