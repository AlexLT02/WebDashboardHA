"""Local zone assignment (``/data/zones.json``), never written to HA.

Structure (zones, sections, facts, Lage, groups, virtual …) always comes from
the seed. Locally mutable are only ``items``, ``favorites``, ``first_seen``,
``seen`` (plus ``aliases``: HA renames old -> new, applied to the seed).
"""

from __future__ import annotations

import copy
import json
import logging
import time
from pathlib import Path
from typing import Any, Callable

log = logging.getLogger("webdashboardha.zones")

SEED_PATH = Path(__file__).resolve().parent / "seed" / "zonen-startbelegung.json"
SCHEMA = 1
NAME_MAX = 14
TIERS = ("zone", "all", "hidden")
FUNCS = ("licht", "ambiente", "medien", "klima")
FAVORITES_MAX = 15
# Fields the user edits; a newer seed must never overwrite them.
USER_FIELDS = ("zone", "name", "tier", "func", "order")


class ZoneError(ValueError):
    """Invalid edit (maps to HTTP 422)."""


def load_seed(path: Path = SEED_PATH) -> dict[str, Any]:
    return json.loads(path.read_text("utf-8"))


def _rename_refs(obj: Any, old: str, new: str) -> Any:
    if isinstance(obj, str):
        return new if obj == old else obj
    if isinstance(obj, list):
        return [_rename_refs(v, old, new) for v in obj]
    if isinstance(obj, dict):
        return {(new if k == old else k): _rename_refs(v, old, new) for k, v in obj.items()}
    return obj


def default_func(entity_id: str) -> str:
    domain = entity_id.split(".")[0]
    if domain == "light":
        return "licht"
    if domain in ("cover", "climate"):
        return "klima"
    return "medien"


class ZoneStore:
    def __init__(
        self,
        path: Path,
        seed: dict[str, Any],
        *,
        now: Callable[[], float] = time.time,
    ) -> None:
        self._path = path
        self._seed_raw = seed
        self._now = now
        self.items: dict[str, dict[str, Any]] = {}
        self.favorites: list[dict[str, Any]] = []
        self.first_seen: dict[str, int] = {}
        self.seen: list[str] = []
        self.aliases: dict[str, str] = {}
        self.seed_version = 0

    # ---- seed -------------------------------------------------------------

    @property
    def seed(self) -> dict[str, Any]:
        """Seed with HA renames applied (structure references follow renames)."""
        cfg = self._seed_raw
        for old, new in self.aliases.items():
            cfg = _rename_refs(cfg, old, new)
        return cfg

    def zone_ids(self) -> list[str]:
        return [z["id"] for z in self._seed_raw.get("zones", [])]

    def group_ids(self) -> list[str]:
        return [g["id"] for g in self.seed.get("groups", [])]

    # ---- load / save ------------------------------------------------------

    def load(self) -> None:
        if not self._path.exists():
            self._init_from_seed()
            self.save()
            log.info("zones.json aus Startbelegung angelegt (%d Einträge).", len(self.items))
            return
        raw = json.loads(self._path.read_text("utf-8"))
        self.items = raw.get("items") or {}
        self.favorites = raw.get("favorites") or []
        self.first_seen = {k: int(v) for k, v in (raw.get("first_seen") or {}).items()}
        self.seen = list(raw.get("seen") or [])
        self.aliases = raw.get("aliases") or {}
        self.seed_version = int(raw.get("seed_version") or 0)
        if int(self._seed_raw.get("seed_version", 0)) > self.seed_version:
            self._merge_seed()
            self.save()

    def _init_from_seed(self) -> None:
        seed = self.seed
        now = int(self._now())
        self.items = copy.deepcopy(seed.get("items") or {})
        self.favorites = copy.deepcopy(seed.get("favorites") or [])
        self.first_seen = {k: now for k, v in self.items.items() if v.get("new")}
        self.seen = []
        self.seed_version = int(seed.get("seed_version", 0))

    def _merge_seed(self) -> None:
        """Newer seed: add missing items and missing non-user fields only."""
        seed = self.seed
        now = int(self._now())
        added = 0
        for item_id, seed_item in (seed.get("items") or {}).items():
            local = self.items.get(item_id)
            if local is None:
                self.items[item_id] = copy.deepcopy(seed_item)
                added += 1
                if seed_item.get("new"):
                    self.first_seen.setdefault(item_id, now)
                continue
            for key, value in seed_item.items():
                if key not in local and key not in USER_FIELDS:
                    local[key] = copy.deepcopy(value)
        self.seed_version = int(seed.get("seed_version", 0))
        log.info("Startbelegung v%d übernommen (%d neue Einträge).", self.seed_version, added)

    def to_json(self) -> dict[str, Any]:
        return {
            "schema": SCHEMA,
            "seed_version": self.seed_version,
            "items": self.items,
            "favorites": self.favorites,
            "first_seen": self.first_seen,
            "seen": self.seen,
            "aliases": self.aliases,
        }

    def save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        # Atomic like storage.py: temp file, then rename.
        tmp = self._path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(self.to_json(), ensure_ascii=False, indent=2), "utf-8")
        tmp.replace(self._path)

    # ---- HA rename --------------------------------------------------------

    def rename(self, old: str, new: str) -> bool:
        """Re-key everything local after an entity_id change in HA."""
        if old == new:
            return False
        changed = False
        if old in self.items:
            self.items[new] = self.items.pop(old)
            changed = True
        for fav in self.favorites:
            if fav.get("id") == old:
                fav["id"] = new
                changed = True
        if old in self.first_seen:
            self.first_seen[new] = self.first_seen.pop(old)
            changed = True
        if old in self.seen:
            self.seen = [new if s == old else s for s in self.seen]
            changed = True
        if old in _collect_strings(self._seed_raw) or old in self.aliases.values():
            # Chain renames: a -> b, later b -> c  =>  a -> c, b -> c.
            for k, v in list(self.aliases.items()):
                if v == old:
                    self.aliases[k] = new
            self.aliases[old] = new
            changed = True
        if changed:
            self.save()
        return changed

    # ---- edits (validated; the caller checks that the id is known) ---------

    def first_seen_add(self, ids: dict[str, int]) -> None:
        new = {k: v for k, v in ids.items() if k not in self.first_seen}
        if new:
            self.first_seen.update(new)
            self.save()

    def patch(self, item_id: str, changes: dict[str, Any], *, ha_name: str | None = None,
              section_peers: Callable[[str], list[str]] | None = None) -> None:
        """Apply a subset of {zone, name, tier, func, order_step}."""
        seed_items = self.seed.get("items") or {}
        item = self.items.get(item_id)
        group = next((g for g in self.seed.get("groups", []) if g["id"] == item_id), None)
        if item is not None:
            item = copy.deepcopy(item)
        elif group is not None:
            # Chip override starts from the seed group, not from the inbox.
            item = {k: group[k] for k in ("zone", "name", "order") if k in group}
        else:
            item = {"zone": None, "func": default_func(item_id)}

        if "zone" in changes:
            zone = changes["zone"]
            if zone is not None and zone not in self.zone_ids():
                raise ZoneError(f"unbekannte Zone: {zone}")
            if item.get("zone") != zone:
                item["zone"] = zone
                item.pop("order", None)  # append at the end of the new zone
        if "func" in changes:
            func = changes["func"]
            if func not in FUNCS:
                raise ZoneError(f"unbekannte Funktion: {func}")
            item["func"] = func
        if "tier" in changes:
            tier = changes["tier"]
            if tier not in TIERS:
                raise ZoneError(f"unbekannte Stufe: {tier}")
            item["tier"] = tier
        if "name" in changes:
            name = changes["name"]
            if name is None:
                seed_name = (seed_items.get(item_id) or {}).get("name")
                if seed_name:
                    item["name"] = seed_name
                else:
                    item.pop("name", None)
            else:
                item["name"] = validate_name(name)
        if item_id not in self.items and "name" not in item and ha_name:
            item["name"] = ha_name[:NAME_MAX].rstrip()
        if item.get("zone") is not None and "order" not in item:
            item["order"] = self._next_order(item.get("zone"))

        self.items[item_id] = item
        if "order_step" in changes and section_peers is not None:
            step = changes["order_step"]
            if step not in (-1, 1):
                raise ZoneError("order_step muss -1 oder 1 sein")
            self._move(item_id, step, section_peers(item_id))
        self.save()

    def _next_order(self, zone: str | None) -> int:
        orders = [int(v.get("order") or 0) for v in self.items.values() if v.get("zone") == zone]
        return (max(orders) if orders else 0) + 10

    def _move(self, item_id: str, step: int, peers: list[str]) -> None:
        """Swap with the neighbour in the sorted section list, renumber 10, 20 …"""
        if item_id not in peers:
            return
        idx = peers.index(item_id)
        target = idx + step
        if target < 0 or target >= len(peers):
            return
        peers = list(peers)
        peers[idx], peers[target] = peers[target], peers[idx]
        for pos, pid in enumerate(peers):
            entry = self.items.setdefault(pid, {"zone": None, "func": default_func(pid)})
            entry["order"] = (pos + 1) * 10

    def reset(self, item_id: str) -> None:
        seed_item = (self.seed.get("items") or {}).get(item_id)
        if seed_item is not None:
            self.items[item_id] = copy.deepcopy(seed_item)
        else:
            self.items.pop(item_id, None)
        self.save()

    def mark_seen(self, item_id: str) -> None:
        if item_id not in self.seen:
            self.seen.append(item_id)
            self.save()

    def set_favorites(self, ids: list[str], names: dict[str, str]) -> None:
        if len(ids) > FAVORITES_MAX:
            raise ZoneError(f"höchstens {FAVORITES_MAX} Favoriten")
        if len(set(ids)) != len(ids):
            raise ZoneError("Favorit doppelt")
        old = {f["id"]: f for f in self.favorites}
        result = []
        for fid in ids:
            entry = copy.deepcopy(old.get(fid) or {"id": fid})
            entry["name"] = entry.get("name") or names.get(fid, fid)[:NAME_MAX].rstrip()
            result.append(entry)
        self.favorites = result
        self.save()


def validate_name(name: Any) -> str:
    if not isinstance(name, str):
        raise ZoneError("Name muss Text sein")
    name = name.strip()
    if not 1 <= len(name) <= NAME_MAX:
        raise ZoneError(f"Name muss 1 bis {NAME_MAX} Zeichen haben")
    return name


def _collect_strings(obj: Any) -> set[str]:
    out: set[str] = set()
    if isinstance(obj, str):
        out.add(obj)
    elif isinstance(obj, list):
        for v in obj:
            out |= _collect_strings(v)
    elif isinstance(obj, dict):
        for k, v in obj.items():
            out.add(k)
            out |= _collect_strings(v)
    return out
