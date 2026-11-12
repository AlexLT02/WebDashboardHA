import { describe, expect, it } from "vitest";
import { nightlyDue, versionReloadDue } from "./reload";
import { nightOnPct } from "./night";

const d = (s: string) => new Date(s);

describe("nightlyDue", () => {
  it("fires once the first 04:00 after load has passed", () => {
    expect(nightlyDue(d("2026-11-12T03:10:00"), d("2026-11-12T03:59:00"))).toBe(false);
    expect(nightlyDue(d("2026-11-12T03:10:00"), d("2026-11-12T04:00:00"))).toBe(true);
    expect(nightlyDue(d("2026-11-11T22:00:00"), d("2026-11-12T00:30:00"))).toBe(false);
    expect(nightlyDue(d("2026-11-11T22:00:00"), d("2026-11-12T09:15:00"))).toBe(true);
  });
  it("does not fire again after the 04:00 reload", () => {
    expect(nightlyDue(d("2026-11-12T04:00:05"), d("2026-11-12T23:59:00"))).toBe(false);
  });
});

describe("versionReloadDue", () => {
  it("only on a real mismatch, at most once per server version", () => {
    expect(versionReloadDue("2.0.0", "2.0.0", null)).toBe(false);
    expect(versionReloadDue("2.0.1", "2.0.0", null)).toBe(true);
    expect(versionReloadDue("2.0.1", "2.0.0", "2.0.1")).toBe(false);
    expect(versionReloadDue(null, "2.0.0", null)).toBe(false);
    expect(versionReloadDue("2.0.1", "", null)).toBe(false);
  });
});

describe("nightOnPct (D14)", () => {
  const s = { night: true, nightStart: "22:30", nightEnd: "06:30", nightOnPct: 15 };
  it("dims inside the window only", () => {
    expect(nightOnPct(s, d("2026-11-12T01:29:00"))).toBe(15);
    expect(nightOnPct(s, d("2026-11-12T12:00:00"))).toBeUndefined();
  });
  it("off when the setting is Aus or the night window is disabled", () => {
    expect(nightOnPct({ ...s, nightOnPct: 0 }, d("2026-11-12T01:29:00"))).toBeUndefined();
    expect(nightOnPct({ ...s, night: false }, d("2026-11-12T01:29:00"))).toBeUndefined();
  });
});
