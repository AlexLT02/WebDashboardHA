"""Board model: pure function from seed + local zones + registry + states.

No I/O here. The caller (hub) persists ``first_seen_new`` and assigns ``rev``.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Iterable, Protocol

from .registry import Registry

TILE_DOMAINS = ("light", "switch", "fan", "cover", "climate", "media_player", "vacuum", "input_boolean")
# Step 6, "one device, one tile": highest domain wins (cover before its backlight).
DOMAIN_RANK = ("cover", "climate", "light", "media_player", "vacuum", "fan", "switch", "input_boolean")
COLOR_MODES = {"hs", "xy", "rgb", "rgbw", "rgbww"}
CLOUD_PLATFORMS = {"tuya", "alexa_devices"}
HIDE_LABEL = "dontshowindashboard"
GROUP_KINDS = {"group", "switch_group"}
VIRTUAL_PREFIX = "virtual."
FORECAST_ID = "wdh.forecast_today"
NEW_FOR_S = 7 * 24 * 3600
SUPPORT_SET_POSITION = 4

# Frontend defaults of the alert helpers (state/useBoard.ts DEFAULT_SETTINGS).
ALERT_DEFAULTS = {
    "alertSwitchEntity": "input_boolean.dashboard_alert",
    "alertTextEntity": "input_text.dashboard_alert_text",
    "alertLevelEntity": "input_select.dashboard_alert_level",
    "alertSlotPrefix": "input_text.wdh_slot_",
    "alertIndexEntity": "input_number.wdh_index",
}

SUGGEST_KEYWORDS = (
    (("küche", "kühl"), "kueche"),
    (("bad",), "bad"),
    (("bett", "schlaf", "kleiderschrank"), "bett"),
    (("schreibtisch", "pc", "monitor", "studio"), "pc"),
    (("sofa", "tv", "wohn", "eingang"), "wohnbereich"),
)

_ENTITY_RE = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")


class ZoneData(Protocol):
    items: dict[str, dict[str, Any]]
    favorites: list[dict[str, Any]]
    first_seen: dict[str, int]
    seen: list[str]


@dataclass
class Board:
    data: dict[str, Any]
    watch: set[str] = field(default_factory=set)
    first_seen_new: dict[str, int] = field(default_factory=dict)


# ---- helpers ------------------------------------------------------------------


def domain_of(entity_id: str) -> str:
    return entity_id.split(".", 1)[0]


def is_entity_ref(value: Any) -> bool:
    return isinstance(value, str) and bool(_ENTITY_RE.match(value)) and not value.startswith(VIRTUAL_PREFIX)


def collect_entity_refs(obj: Any, out: set[str]) -> None:
    if isinstance(obj, str):
        if is_entity_ref(obj):
            out.add(obj)
    elif isinstance(obj, dict):
        for v in obj.values():
            collect_entity_refs(v, out)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            collect_entity_refs(v, out)


def ha_name(entity_id: str, registry: Registry, states: dict[str, dict[str, Any]]) -> str:
    entry = registry.entity(entity_id) or {}
    st = states.get(entity_id) or {}
    return (
        (st.get("attributes") or {}).get("friendly_name")
        or entry.get("name")
        or entry.get("original_name")
        or entity_id
    )


def suggest_zone(name: str) -> str | None:
    low = name.lower()
    for words, zone in SUGGEST_KEYWORDS:
        if any(w in low for w in words):
            return zone
    return None


def is_cloud(entity_id: str, registry: Registry) -> bool:
    entry = registry.entity(entity_id) or {}
    platform = entry.get("platform")
    if platform in CLOUD_PLATFORMS:
        return True
    return platform == "mqtt" and str(entry.get("unique_id") or "").startswith("gv2mqtt")


def light_features(attrs: dict[str, Any], kelvin_min: int | None) -> dict[str, Any]:
    modes = list(attrs.get("supported_color_modes") or [])
    features: dict[str, Any] = {
        "brightness": any(m != "onoff" for m in modes),
        "color": any(m in COLOR_MODES for m in modes),
    }
    lo, hi = attrs.get("min_color_temp_kelvin"), attrs.get("max_color_temp_kelvin")
    if "color_temp" in modes and lo and hi:
        features["ct"] = [max(int(kelvin_min or 0), int(lo)), int(hi)]
    return features


def derive_kind(entity_id: str, item: dict[str, Any], state: dict[str, Any] | None) -> str:
    if item.get("kind"):
        return item["kind"]
    domain = domain_of(entity_id)
    attrs = (state or {}).get("attributes") or {}
    if domain == "light":
        if attrs.get("entity_id"):
            return "group"
        if list(attrs.get("supported_color_modes") or []) == ["onoff"]:
            return "light_onoff"
        return "light"
    if domain in ("switch", "fan"):
        return "switch_critical" if item.get("critical") else "switch"
    if domain == "cover":
        return "cover_pos" if int(attrs.get("supported_features") or 0) & SUPPORT_SET_POSITION else "cover"
    if domain == "media_player":
        return "media"
    return domain  # input_boolean, climate, vacuum


def default_icon(kind: str, func: str | None, domain: str) -> str:
    by_kind = {
        "group": "bulb", "switch_group": "monitor", "switch": "plug", "switch_critical": "plug",
        "cover": "blinds", "cover_pos": "blinds", "climate_tuya": "heater", "climate": "air",
        "tv": "tv", "media": "tv", "music_room": "music", "multiroom": "music",
        "appliance": "dishwasher", "status_led": "strip", "input_boolean": "power", "vacuum": "vacuum",
    }
    if kind in by_kind:
        return by_kind[kind]
    if domain == "light":
        return "lamp" if func == "ambiente" else "ceiling"
    return "power"


def ts_ms(iso: Any) -> int | None:
    if not isinstance(iso, str) or not iso:
        return None
    try:
        return int(datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp() * 1000)
    except ValueError:
        return None


# ---- the build ------------------------------------------------------------------


def build_board(
    seed_cfg: dict[str, Any],
    store: ZoneData,
    registry: Registry,
    states: dict[str, dict[str, Any]],
    now: float,
    settings: dict[str, Any] | None = None,
) -> Board:
    seed = seed_cfg
    now_i = int(now)
    local = store.items
    groups_seed = {g["id"]: g for g in seed.get("groups", [])}
    virtual_seed: dict[str, dict[str, Any]] = seed.get("virtual", {})
    zone_ids = [z["id"] for z in seed.get("zones", [])]
    scope_areas = set(seed.get("scope_areas", []))
    orphans: list[dict[str, str]] = []

    def exists(eid: str) -> bool:
        entry = registry.entity(eid)
        return eid in states and not (entry and entry.get("disabled_by"))

    def count_false(eid: str) -> bool:
        return (local.get(eid) or {}).get("count") is False

    # ---- Quelle A: explicit entries -----------------------------------------
    explicit: dict[str, dict[str, Any]] = {}  # id -> merged entry
    where: dict[str, list[str]] = {}

    def add_explicit(eid: str, entry: dict[str, Any], src: str) -> None:
        where.setdefault(eid, []).append(src)
        if eid not in explicit:
            explicit[eid] = entry

    for eid, entry in local.items():
        if eid in groups_seed:
            continue  # chip override, merged below
        add_explicit(eid, dict(entry), "items")
    for gid, g in groups_seed.items():
        merged = {k: g[k] for k in ("zone", "name", "order") if k in g}
        merged.update(local.get(gid) or {})
        merged["_group"] = True
        add_explicit(gid, merged, "groups")
    for vid in virtual_seed:
        add_explicit(vid, dict(local.get(vid) or {}), "virtual")
    for fav in store.favorites:
        fid = fav.get("id")
        if fid:
            add_explicit(fid, dict(local.get(fid) or {}), "favorites")

    items: dict[str, dict[str, Any]] = {}

    def virtual_item(vid: str, entry: dict[str, Any]) -> dict[str, Any] | None:
        cfg = virtual_seed.get(vid)
        if cfg is None:
            return None
        kind = entry.get("kind") or cfg.get("kind")
        item: dict[str, Any] = {"kind": kind}
        if kind == "switch_group":
            members = []
            for m in cfg.get("members", []):
                if exists(m):
                    members.append(m)
                else:
                    orphans.append({"id": m, "where": vid})
            if not members:
                return None
            item["members"] = members
            item["mode"] = cfg.get("mode")
            item["cloud"] = any(is_cloud(m, registry) for m in members)
            return item
        required = cfg.get("primary") if kind == "tv" else cfg.get("state")
        if required and not exists(required):
            orphans.append({"id": required, "where": vid})
            return None
        for k, v in cfg.items():
            if k != "kind":
                item[k] = v
        if kind == "tv":
            item["cloud"] = is_cloud(cfg["primary"], registry)
        return item

    for eid, entry in explicit.items():
        is_virtual = eid.startswith(VIRTUAL_PREFIX)
        if is_virtual:
            base = virtual_item(eid, entry)
            if base is None:
                for src in where[eid]:
                    orphans.append({"id": eid, "where": src})
                continue
        elif not exists(eid):
            for src in where[eid]:
                orphans.append({"id": eid, "where": src})
            continue
        else:
            base = {}

        state = states.get(eid)
        domain = domain_of(eid)
        kind = base.get("kind") or derive_kind(eid, entry, state)
        func = entry.get("func") or (None if entry.get("system") else _func_default(eid, kind))
        tier = entry.get("tier") or "zone"
        item = {
            "id": eid,
            "kind": kind,
            "name": entry.get("name") or ha_name(eid, registry, states),
            "zone": entry.get("zone"),
            "func": func,
            "tier": tier,
            "order": entry.get("order"),
            "icon": entry.get("icon") or default_icon(kind, func, domain),
            "count": False,
            "new": False,
            "cloud": False,
        }
        if not entry.get("name"):
            item["name_auto"] = True
        item.update({k: v for k, v in base.items() if k != "kind"})
        if kind == "group" and not is_virtual:
            attrs = (state or {}).get("attributes") or {}
            members = [m for m in attrs.get("entity_id") or [] if not count_false(m) and exists(m)]
            item["members"] = members
            item["cloud"] = any(is_cloud(m, registry) for m in members)
            item["features"] = light_features(attrs, entry.get("kelvin_min"))
        elif not is_virtual:
            item["count"] = entry.get("count", True) is not False
            item["cloud"] = is_cloud(eid, registry)
            if domain == "light":
                item["features"] = light_features((state or {}).get("attributes") or {}, entry.get("kelvin_min"))
            elif domain == "cover":
                sf = int(((state or {}).get("attributes") or {}).get("supported_features") or 0)
                item["features"] = {"position": bool(sf & SUPPORT_SET_POSITION)}
        for key in ("critical", "power", "extra", "heating_room", "system"):
            if entry.get(key):
                item[key] = entry[key]
        if entry.get("_group"):
            item["chip"] = True
        first = store.first_seen.get(eid)
        item["new"] = bool(first and now_i - first < NEW_FOR_S and eid not in store.seen)
        items[eid] = item

    # ---- Quelle B: registry entities in scope -----------------------------------
    candidates: list[str] = []
    for eid, entry in registry.entities.items():
        if eid in explicit:
            continue
        if registry.effective_area(eid) not in scope_areas:
            continue
        if not exists(eid):  # 1
            continue
        if entry.get("hidden_by"):  # 2
            continue
        if entry.get("entity_category"):  # 3
            continue
        if HIDE_LABEL in (entry.get("labels") or []):  # 4
            continue
        if domain_of(eid) not in TILE_DOMAINS:  # 5
            continue
        candidates.append(eid)

    best_rank: dict[str, int] = {}
    for eid in candidates:  # 6
        dev = (registry.entity(eid) or {}).get("device_id")
        if dev:
            rank = DOMAIN_RANK.index(domain_of(eid))
            best_rank[dev] = min(best_rank.get(dev, rank), rank)
    survivors = []
    for eid in candidates:
        dev = (registry.entity(eid) or {}).get("device_id")
        if dev and DOMAIN_RANK.index(domain_of(eid)) != best_rank[dev]:
            continue
        survivors.append(eid)

    first_seen_new: dict[str, int] = {}
    inbox_ids: list[str] = []
    for eid in survivors:  # 7
        state = states.get(eid)
        kind = derive_kind(eid, {}, state)
        func = _func_default(eid, kind)
        items[eid] = {
            "id": eid, "kind": kind, "name": ha_name(eid, registry, states), "name_auto": True,
            "zone": None, "func": func, "tier": "zone", "order": None,
            "icon": default_icon(kind, func, domain_of(eid)), "count": True,
            "new": False, "cloud": is_cloud(eid, registry),
        }
        if domain_of(eid) == "light":
            items[eid]["features"] = light_features((state or {}).get("attributes") or {}, None)
        elif domain_of(eid) == "cover":
            sf = int(((state or {}).get("attributes") or {}).get("supported_features") or 0)
            items[eid]["features"] = {"position": bool(sf & SUPPORT_SET_POSITION)}
        inbox_ids.append(eid)
    for eid, item in items.items():  # 8
        if eid in inbox_ids:
            continue
        entry = explicit.get(eid) or {}
        # Also favorites-only entries: a favorite without zone stays in the inbox.
        if item["zone"] is None and item["tier"] != "hidden" and not entry.get("system"):
            inbox_ids.append(eid)

    inbox = []
    for eid in inbox_ids:
        if eid not in store.first_seen:
            first_seen_new[eid] = now_i
        entry = explicit.get(eid) or {}
        device = registry.device_of(eid) or {}
        name = ha_name(eid, registry, states)
        items[eid]["inbox"] = True
        first = store.first_seen.get(eid, first_seen_new.get(eid))
        items[eid]["new"] = bool(first and now_i - first < NEW_FOR_S and eid not in store.seen)
        inbox.append({
            "id": eid,
            "name": entry.get("name") or name,
            "ha_name": name,
            "device": device.get("name_by_user") or device.get("name"),
            "model": device.get("model"),
            "area": registry.effective_area(eid),
            "suggest": entry.get("suggest") or suggest_zone(name),
            "first_seen": first,
        })

    # ---- zones ------------------------------------------------------------------
    def section_of(item: dict[str, Any]) -> str:
        return item.get("func") or "medien"

    def sort_key(eid: str) -> tuple[float, str]:
        order = items[eid].get("order")
        return (order if isinstance(order, (int, float)) else 1e9, items[eid]["name"].lower())

    zones_out = []
    facts = seed.get("facts", {})
    for z in seed.get("zones", []):
        zid = z["id"]
        in_zone = [
            eid for eid, it in items.items()
            if it["zone"] == zid and it["tier"] != "hidden" and not it.get("inbox")
        ]
        tiles = [eid for eid in in_zone if not items[eid].get("chip")]
        chips = sorted((eid for eid in in_zone if items[eid].get("chip")), key=sort_key)
        sections = []
        for sec in seed.get("sections", []):
            ids = sorted(
                (eid for eid in tiles if items[eid]["tier"] == "zone" and section_of(items[eid]) == sec["id"]),
                key=sort_key,
            )
            if ids:
                sections.append({"id": sec["id"], "name": sec["name"], "items": ids})
        all_only = sorted((eid for eid in tiles if items[eid]["tier"] == "all"), key=sort_key)
        light_targets = sorted(
            (
                eid for eid in tiles
                if items[eid].get("func") in ("licht", "ambiente")
                and domain_of(eid) in ("light", "input_boolean")
                and items[eid]["count"]
                and items[eid]["kind"] not in GROUP_KINDS
            ),
            key=sort_key,
        )
        zones_out.append({
            **{k: z[k] for k in ("id", "name", "icon", "vacuum_segment") if k in z},
            "facts": facts.get(zid, {}),
            "chips": chips,
            "sections": sections,
            "all_only": all_only,
            "light_targets": light_targets,
        })

    # ---- start ------------------------------------------------------------------
    kg_out = []
    for kg in seed.get("kommen_gehen", []):
        role = kg.get("role")
        if role == "ambiente":
            area = kg.get("area")
            action = sorted(
                eid for eid in registry.label_entities(kg.get("label", ""))
                if registry.effective_area(eid) == area
                and domain_of(eid) in kg.get("action_domains", [])
                and exists(eid)
            )
            count = [
                eid for eid in action
                if domain_of(eid) in kg.get("count_domains", []) and not count_false(eid)
            ]
            kg_out.append({"role": role, "name": kg.get("name"), "action": action, "count": count})
        elif role == "group":
            gid = kg["id"]
            if not exists(gid):
                orphans.append({"id": gid, "where": "kommen_gehen"})
                continue
            attrs = (states.get(gid) or {}).get("attributes") or {}
            members = [m for m in attrs.get("entity_id") or [] if not count_false(m) and exists(m)]
            kg_out.append({
                "role": role, "id": gid, "name": kg.get("name"), "members": members,
                "features": light_features(attrs, None),
                "cloud": any(is_cloud(m, registry) for m in members),
            })
        else:
            kg_out.append(dict(kg))

    favorites = []
    for fav in store.favorites:
        fid = fav.get("id")
        if fid in items:
            out = {"id": fid, "name": fav.get("name") or items[fid]["name"]}
            if fav.get("kind"):
                out["kind"] = fav["kind"]
            favorites.append(out)

    head = dict(seed.get("head", {}))
    head["forecast"] = FORECAST_ID
    start = {
        "kommen_gehen": kg_out,
        "favorites": favorites,
        "head": head,
        "lage": seed.get("lage", []),
        "lage_trim_order": seed.get("lage_trim_order", []),
    }

    hidden = sorted(eid for eid, it in items.items() if it["tier"] == "hidden")

    data: dict[str, Any] = {
        "zones": zones_out,
        "items": items,
        "start": start,
        "heating": seed.get("heating", {}),
        "music": seed.get("music", {}),
        "door_reset": seed.get("door_reset"),
        "undo_scene_id": seed.get("undo_scene_id", "wdh_undo"),
        "inbox": inbox,
        "hidden": hidden,
        "orphans": _dedupe(orphans),
    }

    # ---- watch-set --------------------------------------------------------------
    watch: set[str] = set()
    for eid, it in items.items():
        if is_entity_ref(eid):
            watch.add(eid)
        collect_entity_refs({k: v for k, v in it.items() if k not in ("id", "name", "icon")}, watch)
    for z in zones_out:
        collect_entity_refs(z["facts"], watch)
    collect_entity_refs(start, watch)
    collect_entity_refs(data["heating"], watch)
    collect_entity_refs(data["music"], watch)
    collect_entity_refs(data["door_reset"], watch)
    watch |= alert_entities(settings)
    watch.add(FORECAST_ID)
    data["watch_count"] = len(watch)
    return Board(data=data, watch=watch, first_seen_new=first_seen_new)


VACUUM_ATTRS = (
    "friendly_name", "status", "battery", "fan_speed", "fan_speed_list",
    "cleaning_progress", "error", "supported_features",
)


def slim_state(state: dict[str, Any]) -> dict[str, Any]:
    """State for the v2 stream: attribute diet, epoch-ms instead of HA timestamps."""
    eid = state.get("entity_id", "")
    attrs = dict(state.get("attributes") or {})
    if domain_of(eid) == "vacuum":
        attrs = {k: attrs[k] for k in VACUUM_ATTRS if k in attrs}
    else:
        for key in list(attrs):
            if key == "entity_picture" or key.startswith("media_image_"):
                del attrs[key]
    out: dict[str, Any] = {
        "entity_id": eid,
        "state": state.get("state"),
        "attributes": attrs,
        "lc_ts": ts_ms(state.get("last_changed")),
    }
    if domain_of(eid) == "timer":
        out["finishes_ts"] = ts_ms(attrs.get("finishes_at"))
    return out


def alert_entities(settings: dict[str, Any] | None) -> set[str]:
    cfg = {**ALERT_DEFAULTS, **(settings or {})}
    out = {cfg[k] for k in ("alertSwitchEntity", "alertTextEntity", "alertLevelEntity", "alertIndexEntity")}
    prefix = cfg.get("alertSlotPrefix") or ""
    if prefix:
        out |= {f"{prefix}{i}" for i in range(1, 5)}
    return {e for e in out if is_entity_ref(e)}


def _func_default(entity_id: str, kind: str) -> str:
    if kind in ("tv", "media", "music_room", "appliance", "switch_group", "switch", "switch_critical"):
        return "medien"
    domain = domain_of(entity_id)
    if domain == "light":
        return "licht"
    if domain in ("cover", "climate"):
        return "klima"
    if domain == "input_boolean":
        return "ambiente"
    return "medien"


def _dedupe(rows: Iterable[dict[str, str]]) -> list[dict[str, str]]:
    seen, out = set(), []
    for r in rows:
        key = (r["id"], r["where"])
        if key not in seen:
            seen.add(key)
            out.append(r)
    return out
