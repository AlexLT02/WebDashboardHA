import { describe, expect, it } from "vitest";
import { acOn, boostOf, climateLimits, HEAT_MAX, hvacAllowed, isManualSoll } from "./climate";
import type { EntityState } from "./model";

const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}, extra: Partial<EntityState> = {}): EntityState => ({
  entity_id, state, attributes, lc_ts: 0, ...extra,
});

describe("hvac allowlist (PL decision B2)", () => {
  it("only the air conditioner may get an hvac mode", () => {
    expect(hvacAllowed("climate.klima")).toBe(true);
    expect(hvacAllowed("climate.thermostat_wohnbereich_alex")).toBe(false);
    expect(hvacAllowed("climate.alex_wohnung_thermostat_bad")).toBe(false);
    expect(hvacAllowed("climate.irgendwas")).toBe(false);
  });
});

describe("limits", () => {
  it("heating: step 0.5, max capped at 30 (M5-G reports 95)", () => {
    const l = climateLimits(st("climate.t", "unknown", { min_temp: 5, max_temp: 95, target_temp_step: 0.5 }), true);
    expect(l).toEqual({ min: 5, max: HEAT_MAX, step: 0.5 });
  });
  it("air conditioner: step 1 and its own range", () => {
    expect(climateLimits(st("climate.klima", "off", { min_temp: 16, max_temp: 86, target_temp_step: 1 }), false)).toEqual({ min: 16, max: 86, step: 1 });
  });
});

describe("manual set point", () => {
  it("a value sent from the iPad or one that differs from the plan is manual", () => {
    expect(isManualSoll(23, 23, null)).toBe(false);
    expect(isManualSoll(23.5, 23, null)).toBe(true);
    expect(isManualSoll(23, 23, 23.5)).toBe(true);
    expect(isManualSoll(23, null, null)).toBe(false);
  });
});

describe("boost", () => {
  it("reads the timer", () => {
    expect(boostOf(st("timer.b", "idle"))).toEqual({ active: false, until: null });
    expect(boostOf(st("timer.b", "active", {}, { finishes_ts: 1000 }))).toEqual({ active: true, until: 1000 });
    expect(boostOf(undefined).active).toBe(false);
  });
});

describe("air conditioner on", () => {
  it("cool is on, off/unavailable are not", () => {
    expect(acOn(st("climate.klima", "cool"))).toBe(true);
    expect(acOn(st("climate.klima", "off"))).toBe(false);
    expect(acOn(st("climate.klima", "unavailable"))).toBe(false);
  });
});
