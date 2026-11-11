import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COLLECT_MS, createCollector, stepTarget } from "./collect";

describe("collector", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const timers = { set: (fn: () => void, ms: number) => setTimeout(fn, ms) as unknown as number, clear: (id: number) => clearTimeout(id) };

  it("three quick taps send exactly one call, 800 ms after the last", () => {
    const sent: number[] = [];
    const c = createCollector<number>(COLLECT_MS, (_a, v) => v, (v) => sent.push(v), timers);
    c.push(23.5);
    vi.advanceTimersByTime(300);
    c.push(24);
    vi.advanceTimersByTime(300);
    c.push(24.5);
    vi.advanceTimersByTime(799);
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(sent).toEqual([24.5]);
    vi.advanceTimersByTime(5000);
    expect(sent).toEqual([24.5]);
  });

  it("sums deltas (IR presses) and nets opposite taps", () => {
    const sent: number[] = [];
    const c = createCollector<number>(COLLECT_MS, (a, v) => (a || 0) + v, (v) => sent.push(v), timers);
    c.push(1);
    c.push(1);
    c.push(1);
    c.push(-1);
    expect(c.current()).toBe(2);
    vi.advanceTimersByTime(COLLECT_MS);
    expect(sent).toEqual([2]);
  });

  it("flush sends at once (popup closes), cancel drops", () => {
    const sent: number[] = [];
    const c = createCollector<number>(COLLECT_MS, (_a, v) => v, (v) => sent.push(v), timers);
    c.push(21);
    c.flush();
    expect(sent).toEqual([21]);
    c.push(22);
    c.cancel();
    vi.advanceTimersByTime(2000);
    expect(sent).toEqual([21]);
    c.flush();
    expect(sent).toEqual([21]);
  });
});

describe("stepTarget", () => {
  it("moves to the next grid value", () => {
    expect(stepTarget(23, 1, 0.5, 5, 30)).toBe(23.5);
    expect(stepTarget(23, -1, 0.5, 5, 30)).toBe(22.5);
    expect(stepTarget(22.8, 1, 0.5, 5, 30)).toBe(23);
    expect(stepTarget(22.8, -1, 0.5, 5, 30)).toBe(22.5);
    expect(stepTarget(16, 1, 1, 16, 32)).toBe(17);
  });
  it("clamps to the limits", () => {
    expect(stepTarget(30, 1, 0.5, 5, 30)).toBe(30);
    expect(stepTarget(5, -1, 0.5, 5, 30)).toBe(5);
    expect(stepTarget(16, -1, 1, 16, 32)).toBe(16);
  });
});
