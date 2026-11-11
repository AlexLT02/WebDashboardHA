import { describe, expect, it } from "vitest";
import { lightHeadState, lightPip, tileView, type TileCtx } from "./tileState";
import type { EntityState, Item, Kind } from "./model";

const T0 = new Date(2026, 10, 11, 14, 2).getTime();

function st(entity_id: string, state: string, attributes: Record<string, unknown> = {}, lc = T0): EntityState {
  return { entity_id, state, attributes, lc_ts: lc };
}

function item(id: string, kind: Kind, extra: Partial<Item> = {}): Item {
  return {
    id, kind, name: "Test", zone: "z", func: "licht", tier: "zone", order: null, icon: "ceiling",
    count: true, new: false, cloud: false, ...extra,
  };
}

function ctx(states: EntityState[], extra: Partial<TileCtx> = {}): TileCtx {
  const map: Record<string, EntityState> = {};
  for (const s of states) map[s.entity_id] = s;
  return { get: (id) => map[id], now: T0 + 60000, ...extra };
}

describe("light", () => {
  const it1 = item("light.a", "light");
  it("shows brightness in percent when on", () => {
    const v = tileView(it1, ctx([st("light.a", "on", { brightness: 163, color_mode: "color_temp" })]));
    expect(v).toMatchObject({ on: true, badge: true, status: "64 %", pip: null });
  });
  it("shows 'An' when HA reports no brightness (Tuya 0)", () => {
    expect(tileView(it1, ctx([st("light.a", "on", { brightness: 0 })])).status).toBe("An");
    expect(tileView(it1, ctx([st("light.a", "on", {})])).status).toBe("An");
  });
  it("is off", () => {
    expect(tileView(it1, ctx([st("light.a", "off")]))).toMatchObject({ on: false, badge: true, status: "Aus" });
  });
  it("adds a colour pip only in a colour mode", () => {
    expect(lightPip(st("light.a", "on", { color_mode: "rgb", rgb_color: [10, 20, 30] }))).toBe("rgb(10,20,30)");
    expect(lightPip(st("light.a", "on", { color_mode: "hs", hs_color: [200, 80] }))).toBe("hsl(200,80%,58%)");
    expect(lightPip(st("light.a", "on", { color_mode: "color_temp", hs_color: [27, 45] }))).toBeNull();
    expect(lightPip(st("light.a", "off", { color_mode: "rgb", rgb_color: [1, 2, 3] }))).toBeNull();
  });
  it("offline never looks like off", () => {
    const v = tileView(it1, ctx([st("light.a", "unavailable")]));
    expect(v).toMatchObject({ offline: true, badge: false, on: false, status: "Offline seit 14:02", offlineSince: T0 });
  });
  it("unknown has no badge", () => {
    expect(tileView(it1, ctx([st("light.a", "unknown")]))).toMatchObject({ unknown: true, badge: false, status: "Zustand unbekannt" });
  });
  it("missing state counts as offline", () => {
    expect(tileView(it1, ctx([])).offline).toBe(true);
  });
  it("popup head reads 'An, 64 %, 3000 K'", () => {
    expect(lightHeadState(st("light.a", "on", { brightness: 163, color_mode: "color_temp", color_temp_kelvin: 3003 }))).toBe("An, 64 %, 3000 K");
    expect(lightHeadState(st("light.a", "off"))).toBe("Aus");
  });
});

describe("groups", () => {
  const g = item("light.zone_x", "group", { members: ["light.a", "light.b", "light.c"] });
  it("counts members", () => {
    const v = tileView(g, ctx([st("light.zone_x", "on"), st("light.a", "on"), st("light.b", "off"), st("light.c", "off")]));
    expect(v).toMatchObject({ on: true, badge: true, status: "1 von 3 an", members: { on: 1, n: 3 } });
  });
  it("is off when only uncounted members are on (group state on)", () => {
    const v = tileView(g, ctx([st("light.zone_x", "on"), st("light.a", "off"), st("light.b", "off"), st("light.c", "off")]));
    expect(v).toMatchObject({ on: false, status: "Aus" });
  });
  it("switch group from members", () => {
    const sg = item("virtual.pc", "switch_group", { members: ["switch.a", "switch.b"] });
    const v = tileView(sg, ctx([st("switch.a", "on"), st("switch.b", "on")]));
    expect(v.status).toBe("2 von 2 an");
    const off = tileView(sg, ctx([st("switch.a", "unavailable"), st("switch.b", "unavailable")]));
    expect(off.offline).toBe(true);
  });
});

describe("switches", () => {
  it("shows power when on and >= 1 W", () => {
    const s = item("switch.m", "switch", { power: "sensor.p" });
    expect(tileView(s, ctx([st("switch.m", "on"), st("sensor.p", "33.6")])).status).toBe("An, 34 W");
    expect(tileView(s, ctx([st("switch.m", "on"), st("sensor.p", "0.4")])).status).toBe("An");
    expect(tileView(s, ctx([st("switch.m", "off"), st("sensor.p", "12")])).status).toBe("Aus");
  });
  it("critical sockets need a hold to switch off", () => {
    const c = item("switch.c", "switch_critical", { power: "sensor.p", critical: true });
    expect(tileView(c, ctx([st("switch.c", "on"), st("sensor.p", "9")]))).toMatchObject({ lock: true, holdOff: true, status: "An, 9 W" });
    expect(tileView(c, ctx([st("switch.c", "off")]))).toMatchObject({ lock: false, holdOff: false, badge: true });
  });
});

describe("climate (D8)", () => {
  const h = item("climate.t", "climate_tuya", { heating_room: "wb" });
  const heating = { rooms: { wb: { climate: "climate.t", ist: "sensor.ist", boost_timer: "timer.b" } } };
  it("shows Ist -> Soll and treats hvac 'unknown' as normal", () => {
    const v = tileView(h, ctx([st("climate.t", "unknown", { temperature: 23 }), st("sensor.ist", "22.84"), st("timer.b", "idle")], { heating }));
    expect(v).toMatchObject({ badge: false, unknown: false, status: "22,8° → 23,0°" });
  });
  it("shows the boost end", () => {
    const end = new Date(2026, 10, 11, 18, 30).getTime();
    const timer: EntityState = { entity_id: "timer.b", state: "active", attributes: {}, finishes_ts: end };
    const v = tileView(h, ctx([st("climate.t", "unknown", { temperature: 25 }), st("sensor.ist", "22"), timer], { heating }));
    expect(v.status).toBe("Boost bis 18:30");
  });
  it("simple climate: off / cooling", () => {
    const k = item("climate.k", "climate");
    expect(tileView(k, ctx([st("climate.k", "off", { temperature: 21 })])).status).toBe("Aus");
    expect(tileView(k, ctx([st("climate.k", "cool", { temperature: 21 })]))).toMatchObject({ on: true, status: "Kühlt auf 21°" });
  });
});

describe("media and music", () => {
  it("tv follows the Fire TV", () => {
    const tv = item("virtual.tv", "tv", { primary: "media_player.ftv", tv: "media_player.tv" });
    expect(tileView(tv, ctx([st("media_player.ftv", "off")]))).toMatchObject({ on: false, badge: true, status: "Aus" });
    expect(tileView(tv, ctx([st("media_player.ftv", "playing", { app_name: "Netflix" })])).status).toBe("Netflix");
    expect(tileView(tv, ctx([st("media_player.ftv", "idle")])).status).toBe("An");
    expect(tileView(tv, ctx([st("media_player.ftv", "unavailable")])).offline).toBe(true);
  });
  it("music room: badge only with multiroom on", () => {
    const m = item("media_player.r", "music_room");
    const music = { multiroom: "input_boolean.mr", rooms: [{ id: "media_player.r", name: "Raum" }] };
    expect(tileView(m, ctx([st("media_player.r", "idle", { volume_level: 0.4 }), st("input_boolean.mr", "off")], { music })))
      .toMatchObject({ badge: false, status: "Aus" });
    expect(tileView(m, ctx([st("media_player.r", "idle", { volume_level: 0.4, is_volume_muted: false }), st("input_boolean.mr", "on")], { music })))
      .toMatchObject({ badge: true, on: true, status: "40 %" });
    expect(tileView(m, ctx([st("media_player.r", "idle", { is_volume_muted: true }), st("input_boolean.mr", "on")], { music })))
      .toMatchObject({ on: false, status: "Stumm" });
  });
  it("multiroom lists the unmuted rooms", () => {
    const mr = item("input_boolean.mr", "multiroom");
    const music = { multiroom: "input_boolean.mr", rooms: [{ id: "media_player.a", name: "Wohnbereich" }, { id: "media_player.b", name: "Bad" }, { id: "media_player.c", name: "PC" }] };
    const v = tileView(mr, ctx([
      st("input_boolean.mr", "on"),
      st("media_player.a", "idle", { is_volume_muted: false }),
      st("media_player.b", "idle", { is_volume_muted: false }),
      st("media_player.c", "idle", { is_volume_muted: true }),
    ], { music }));
    expect(v.status).toBe("Wohnbereich, Bad");
  });
});

describe("appliance (WashData)", () => {
  const a = item("virtual.sm", "appliance", { state: "sensor.z", remaining: "sensor.r" });
  it("running with remaining time", () => {
    expect(tileView(a, ctx([st("sensor.z", "running"), st("sensor.r", "42")]))).toMatchObject({ on: true, badge: false, status: "Läuft, noch 42 min" });
  });
  it("finished, paused, aborted, off", () => {
    expect(tileView(a, ctx([st("sensor.z", "finished", {}, new Date(2026, 10, 11, 18, 42).getTime())])).status).toBe("Fertig seit 18:42");
    expect(tileView(a, ctx([st("sensor.z", "user_paused")])).status).toBe("Pausiert");
    expect(tileView(a, ctx([st("sensor.z", "interrupted")])).status).toBe("Abgebrochen");
    expect(tileView(a, ctx([st("sensor.z", "off")])).status).toBe("Aus");
  });
});

describe("texts", () => {
  it("contain no dashes as punctuation", () => {
    const samples = [
      tileView(item("light.a", "light"), ctx([st("light.a", "on", { brightness: 100 })])).status,
      tileView(item("switch.m", "switch", { power: "sensor.p" }), ctx([st("switch.m", "on"), st("sensor.p", "34")])).status,
    ];
    for (const s of samples) expect(s).not.toMatch(/ [–—] /);
  });
});
