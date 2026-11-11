import { describe, expect, it } from "vitest";
import { coverArrow, coverFeatures, coverMoving, coverPosition, coverStatus, coversSummary } from "./cover";
import type { EntityState } from "./model";

const at = (h: number, m: number) => new Date(2026, 10, 11, h, m).getTime();

function cover(state: string, attrs: Record<string, unknown> = {}, lc = at(7, 30)): EntityState {
  return { entity_id: "cover.x", state, attributes: attrs, lc_ts: lc };
}

describe("coverFeatures", () => {
  it("reads the bit mask", () => {
    expect(coverFeatures({ supported_features: 15 })).toEqual({ open: true, close: true, stop: true, setPosition: true });
    expect(coverFeatures({ supported_features: 11 })).toEqual({ open: true, close: true, stop: true, setPosition: false });
  });
  it("offers up/down/stop without reported features, never a position", () => {
    expect(coverFeatures({})).toEqual({ open: true, close: true, stop: true, setPosition: false });
  });
});

describe("coverPosition / coverMoving / coverArrow", () => {
  it("clamps the position", () => {
    expect(coverPosition({ current_position: 60.4 })).toBe(60);
    expect(coverPosition({ current_position: 140 })).toBe(100);
    expect(coverPosition({})).toBeNull();
  });
  it("detects movement and direction", () => {
    expect(coverMoving("closing")).toBe(true);
    expect(coverMoving("open")).toBe(false);
    expect(coverArrow("closed")).toBe("▼");
    expect(coverArrow("open")).toBe("▲");
  });
});

describe("coverStatus (04 §5.3)", () => {
  it("shows the last command for estimated covers", () => {
    expect(coverStatus(cover("open"), false)).toBe("zuletzt ▲ 07:30");
    expect(coverStatus(cover("closed", {}, at(21, 10)), false)).toBe("zuletzt ▼ 21:10");
  });
  it("shows the running direction", () => {
    expect(coverStatus(cover("closing"), false)).toBe("fährt ▼");
    expect(coverStatus(cover("opening", { current_position: 30 }), true)).toBe("fährt ▲");
  });
  it("shows the position when supported", () => {
    expect(coverStatus(cover("open", { current_position: 40 }), true)).toBe("Offen, 40 %");
    expect(coverStatus(cover("open", { current_position: 100 }), true)).toBe("Offen");
    expect(coverStatus(cover("closed", { current_position: 0 }), true)).toBe("Zu");
  });
  it("never uses dashes or middle dots", () => {
    for (const s of [coverStatus(cover("open"), false), coverStatus(cover("open", { current_position: 40 }), true)]) {
      expect(s).not.toMatch(/[–—·]/);
    }
  });
  it("says unknown instead of guessing", () => {
    expect(coverStatus(cover("unknown"), false)).toBe("Zustand unbekannt");
  });
});

describe("coversSummary (start screen)", () => {
  it("summarises equal covers", () => {
    expect(coversSummary([
      { short: "Treppe", st: cover("open", {}, at(7, 30)) },
      { short: "Schacht", st: cover("open", {}, at(7, 25)) },
    ])).toBe("beide ▲ 07:30");
  });
  it("lists different covers", () => {
    expect(coversSummary([
      { short: "Treppe", st: cover("open") },
      { short: "Schacht", st: cover("closed") },
    ])).toBe("Treppe ▲, Schacht ▼");
  });
  it("handles offline covers", () => {
    expect(coversSummary([
      { short: "Treppe", st: cover("open") },
      { short: "Schacht", st: cover("unavailable") },
    ])).toBe("Treppe ▲, Schacht offline");
  });
});
