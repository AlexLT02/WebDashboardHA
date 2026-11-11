import { describe, expect, it } from "vitest";
import {
  FEEDBACK_MS, TIMEOUT_CLOUD_MS, TIMEOUT_LOCAL_MS, failPend, pendStatus, resolvePend, startPend, timeoutFor,
  withinTolerance,
} from "./pending";

describe("timeouts (04 §5.3)", () => {
  it("5 s local, 8 s cloud or script", () => {
    expect(timeoutFor(false)).toBe(5000);
    expect(timeoutFor(true)).toBe(8000);
    expect(timeoutFor(false, true)).toBe(8000);
    expect(TIMEOUT_LOCAL_MS).toBe(5000);
    expect(TIMEOUT_CLOUD_MS).toBe(8000);
  });
});

describe("resolvePend", () => {
  const t0 = 1_000_000;
  it("shows the target immediately", () => {
    const p = startPend(true, t0, false);
    expect(p).toMatchObject({ on: true, phase: "wait", until: t0 + 5000 });
    expect(pendStatus(p)).toBe("Schaltet ein …");
    expect(pendStatus(startPend(false, t0, false))).toBe("Schaltet aus …");
  });
  it("is confirmed as soon as HA reports the target", () => {
    const p = startPend(true, t0, false);
    expect(resolvePend(p, false, t0 + 300)).toBe(p);
    expect(resolvePend(p, true, t0 + 400)).toBeNull();
  });
  it("falls back with 'Keine Rückmeldung' after the timeout, for 4 s", () => {
    const p = startPend(true, t0, true);
    expect(resolvePend(p, false, t0 + 7999)).toBe(p);
    const n = resolvePend(p, false, t0 + 8000)!;
    expect(n.phase).toBe("noresp");
    expect(pendStatus(n)).toBe("Keine Rückmeldung");
    expect(n.until).toBe(t0 + 8000 + FEEDBACK_MS);
    expect(resolvePend(n, false, t0 + 8000 + FEEDBACK_MS)).toBeNull();
  });
  it("HTTP error: 'Fehlgeschlagen' at once, for 4 s", () => {
    const f = failPend(startPend(true, t0, false), t0 + 100);
    expect(f.phase).toBe("failed");
    expect(pendStatus(f)).toBe("Fehlgeschlagen");
    // A late confirmation does not turn the failure back into success text.
    expect(resolvePend(f, true, t0 + 200)).toBe(f);
    expect(resolvePend(f, true, t0 + 100 + FEEDBACK_MS)).toBeNull();
  });
});

describe("tolerances (02 §5)", () => {
  it("brightness ±3/255, kelvin ±50, hue ±3° circular, position ±2 %", () => {
    expect(withinTolerance("brightness", 128, 131)).toBe(true);
    expect(withinTolerance("brightness", 128, 132)).toBe(false);
    expect(withinTolerance("kelvin", 3200, 3249)).toBe(true);
    expect(withinTolerance("kelvin", 3200, 3251)).toBe(false);
    expect(withinTolerance("hue", 359, 1)).toBe(true);
    expect(withinTolerance("hue", 10, 14)).toBe(false);
    expect(withinTolerance("position", 50, 52)).toBe(true);
    expect(withinTolerance("position", 50, 53)).toBe(false);
    expect(withinTolerance("saturation", 80, 77)).toBe(true);
    expect(withinTolerance("brightness", 128, null)).toBe(false);
  });
});
