import { describe, expect, it } from "vitest";
import {
  applianceView,
  irVolumeCall,
  isRunning,
  segmentCall,
  segmentChips,
  soundText,
  transportOf,
  vacuumButtons,
  vacuumError,
  vacuumHead,
} from "./devices";
import type { EntityState, Zone } from "./model";

const T0 = new Date(2026, 10, 11, 18, 0).getTime();
const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}, lc = T0): EntityState => ({
  entity_id, state, attributes, lc_ts: lc,
});
const getter = (list: EntityState[]) => {
  const m: Record<string, EntityState> = {};
  for (const s of list) m[s.entity_id] = s;
  return (id: string) => m[id];
};

describe("media", () => {
  it("transport from supported_features (Fire TV 22961, Snapcast without prev/next)", () => {
    expect(transportOf(st("media_player.f", "playing", { supported_features: 22961 }))).toEqual({ playPause: true, prev: true, next: true });
    expect(transportOf(st("media_player.s", "idle", { supported_features: 12 }))).toEqual({ playPause: false, prev: false, next: false });
  });
  it("only playing/paused/buffering count as running", () => {
    expect(isRunning(st("m", "playing"))).toBe(true);
    expect(isRunning(st("m", "paused"))).toBe(true);
    expect(isRunning(st("m", "idle"))).toBe(false);
    expect(isRunning(st("m", "off"))).toBe(false);
  });
});

describe("sound system", () => {
  const sound = { mode: "input_select.m", ir_script: "script.ir", vol_up: "switch.up", vol_down: "switch.down" };
  it("one script call with the net count", () => {
    expect(irVolumeCall(sound, 3)).toEqual({
      domain: "script", service: "turn_on", entity_id: "script.ir", data: { variables: { taste: "switch.up", anzahl: 3 } },
    });
    expect(irVolumeCall(sound, -2)!.data).toEqual({ variables: { taste: "switch.down", anzahl: 2 } });
    expect(irVolumeCall(sound, 0)).toBeNull();
  });
  it("mode texts", () => {
    expect(soundText("tv")).toBe("TV");
    expect(soundText("multiroom")).toBe("Multiroom");
    expect(soundText("aus")).toBe("aus");
    expect(soundText("unknown")).toBe("unbekannt");
  });
});

describe("vacuum", () => {
  it("head text", () => {
    expect(vacuumHead(st("vacuum.d", "docked"), "sleeping", 100)).toBe("Bereit in der Station, Akku 100 %");
    expect(vacuumHead(st("vacuum.d", "docked"), "charging", 54)).toBe("Lädt in der Station, Akku 54 %");
    expect(vacuumHead(st("vacuum.d", "cleaning"), "cleaning", null)).toBe("Saugt");
    expect(vacuumHead(st("vacuum.d", "unavailable"), undefined, 3)).toBe("Offline");
  });
  it("only matching buttons are active", () => {
    expect(vacuumButtons("docked")).toEqual({ start: true, resume: false, pause: false, dock: false });
    expect(vacuumButtons("cleaning")).toEqual({ start: false, resume: false, pause: true, dock: true });
    expect(vacuumButtons("paused")).toEqual({ start: true, resume: true, pause: false, dock: true });
    expect(vacuumButtons("unavailable")).toEqual({ start: false, resume: false, pause: false, dock: false });
  });
  it("room chips follow the rail order, the call carries segment ids", () => {
    const zones = [
      { id: "wohnbereich", vacuum_segment: 2 },
      { id: "kueche", vacuum_segment: 4 },
      { id: "bad", vacuum_segment: 1 },
    ] as unknown as Zone[];
    const chips = segmentChips({ segments: { "1": "Bad", "2": "Wohnzimmer", "4": "Küche", "5": "Schlafbereich" } }, zones);
    expect(chips).toEqual([
      { id: 2, name: "Wohnzimmer" }, { id: 4, name: "Küche" }, { id: 1, name: "Bad" }, { id: 5, name: "Schlafbereich" },
    ]);
    expect(segmentCall("vacuum.d", [4, 1])).toEqual({
      domain: "dreame_vacuum", service: "vacuum_clean_segment", entity_id: "vacuum.d", data: { segments: [4, 1] },
    });
  });
  it("error text", () => {
    expect(vacuumError("no_error")).toBe("");
    expect(vacuumError("main_brush_jammed")).toBe("main brush jammed");
  });
});

describe("appliance", () => {
  const refs = { state: "s.z", remaining: "s.r", progress: "s.p", program: "s.prog", phase: "s.ph", power: "s.w", unload_button: "button.u" };
  it("running: remaining time big, finish time, phase", () => {
    const v = applianceView(refs, getter([st("s.z", "running"), st("s.r", "42"), st("s.p", "60"), st("s.prog", "Eco 50"), st("s.ph", "Spülen"), st("s.w", "512.3")]), T0);
    expect(v).toMatchObject({ running: true, big: "noch 42", small: "min", side: "fertig ca. 18:42", phase: "Spülen", program: "Eco 50", progress: 60, power: 512.3, unload: null });
  });
  it("long remaining time in hours", () => {
    expect(applianceView(refs, getter([st("s.z", "running"), st("s.r", "95")]), T0).big).toBe("noch 1 h 35 min");
  });
  it("finished: since, unload button only when usable", () => {
    const lc = T0 - 18 * 60000;
    const v = applianceView(refs, getter([st("s.z", "finished", {}, lc), st("button.u", "unknown")]), T0);
    expect(v).toMatchObject({ done: true, big: "Fertig", side: "seit 17:42", unload: "button.u" });
    expect(applianceView(refs, getter([st("s.z", "finished"), st("button.u", "unavailable")]), T0).unload).toBeNull();
    expect(applianceView(refs, getter([st("s.z", "off"), st("button.u", "unknown")]), T0).unload).toBeNull();
  });
  it("offline and aborted", () => {
    expect(applianceView(refs, getter([]), T0)).toMatchObject({ offline: true, big: "Offline", progress: null });
    expect(applianceView(refs, getter([st("s.z", "force_stopped")]), T0).big).toBe("Abgebrochen");
  });
});
