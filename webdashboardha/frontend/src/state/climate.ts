/**
 * Climate rules (04 D8, PL decision B2 for P4). Pure, tested in climate.test.ts.
 *
 * The two Tuya heating thermostats are driven by `automation.heizung_regler`:
 * the iPad only sets a temperature, starts/ends the boost timer and picks the
 * heating mode helper. An hvac mode or on/off call would send the M5-G into its
 * own auto program, so those calls exist ONLY for the air conditioner below.
 */
import { parseNum } from "./format";
import type { EntityState, Heating, HeatingRoom, Item } from "./model";

/** The only climate entities that may ever get an hvac mode (PL decision B2). */
export const HVAC_ALLOWLIST: readonly string[] = ["climate.klima"];

export function hvacAllowed(entityId: string): boolean {
  return HVAC_ALLOWLIST.indexOf(entityId) !== -1;
}

/** UI ceiling for heating set points (HA reports max_temp 95 for the M5-G). */
export const HEAT_MAX = 30;

export function heatingRoom(item: Item, heating: Heating | undefined): HeatingRoom | undefined {
  return item.heating_room && heating && heating.rooms ? heating.rooms[item.heating_room] : undefined;
}

export interface Limits {
  min: number;
  max: number;
  step: number;
}

export function climateLimits(st: EntityState | undefined, heating: boolean): Limits {
  const a = st ? st.attributes : {};
  const step = parseNum(a.target_temp_step) || (heating ? 0.5 : 1);
  const min = parseNum(a.min_temp);
  const max = parseNum(a.max_temp);
  return {
    min: min !== null ? Math.max(min, heating ? 5 : min) : 5,
    max: heating ? Math.min(max !== null ? max : HEAT_MAX, HEAT_MAX) : max !== null ? max : 32,
    step,
  };
}

/**
 * A set point by hand differs from what the regulator planned; the plan
 * overrides it at its next change (R6), the popup says so.
 */
export function isManualSoll(thermostatSoll: number | null, planned: number | null, local: number | null): boolean {
  if (local !== null) return true;
  if (thermostatSoll === null || planned === null) return false;
  return Math.abs(thermostatSoll - planned) > 0.1;
}

export const PLAN_HINT = "Der Heizplan stellt beim nächsten Wechsel wieder um";

export interface Boost {
  active: boolean;
  until: number | null;
}

export function boostOf(timer: EntityState | undefined): Boost {
  if (!timer || timer.state !== "active") return { active: false, until: null };
  return { active: true, until: typeof timer.finishes_ts === "number" ? timer.finishes_ts : null };
}

/** hvac mode of the air conditioner: "cool" or "off" (anything else counts as on). */
export function acOn(st: EntityState | undefined): boolean {
  return !!st && st.state !== "off" && st.state !== "unavailable" && st.state !== "unknown";
}
