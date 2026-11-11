/**
 * Cover logic (HA domain `cover`): features from `supported_features`,
 * position and the status line (04 §5.3). Pure, tested in cover.test.ts.
 */
import { hhmm } from "./format";
import type { EntityState } from "./model";

// Bit mask of HA `CoverEntityFeature`.
const FEATURE_OPEN = 1;
const FEATURE_CLOSE = 2;
const FEATURE_SET_POSITION = 4;
const FEATURE_STOP = 8;

export interface CoverFeatures {
  open: boolean;
  close: boolean;
  stop: boolean;
  setPosition: boolean;
}

/**
 * Features of a cover. Without any reported features we still offer
 * up/down/stop (simple integrations would be dead otherwise), but never guess
 * a position.
 */
export function coverFeatures(attrs: Record<string, unknown>): CoverFeatures {
  const f = typeof attrs.supported_features === "number" ? attrs.supported_features : 0;
  const unknown = f === 0;
  return {
    open: unknown || (f & FEATURE_OPEN) !== 0,
    close: unknown || (f & FEATURE_CLOSE) !== 0,
    stop: unknown || (f & FEATURE_STOP) !== 0,
    setPosition: (f & FEATURE_SET_POSITION) !== 0,
  };
}

/** Position in percent (100 = fully open) or null if HA reports none. */
export function coverPosition(attrs: Record<string, unknown>): number | null {
  const p = attrs.current_position;
  if (typeof p !== "number" || isNaN(p)) return null;
  return Math.max(0, Math.min(100, Math.round(p)));
}

export function coverMoving(state: string | undefined): boolean {
  return state === "opening" || state === "closing";
}

/** Direction of the last (assumed) movement: ▲ open, ▼ closed. */
export function coverArrow(state: string | undefined): string {
  return state === "closed" || state === "closing" ? "▼" : "▲";
}

/**
 * Status line: "fährt ▼" while moving; with position "Offen, 40 %" / "Zu";
 * estimated covers show the last command "zuletzt ▲ 07:30" (02 B6), because
 * `assumed_state` would make a guess look like a fact.
 */
export function coverStatus(st: EntityState, withPosition: boolean): string {
  if (st.state === "opening") return "fährt ▲";
  if (st.state === "closing") return "fährt ▼";
  if (withPosition) {
    const p = coverPosition(st.attributes);
    if (p !== null) {
      if (p <= 0) return "Zu";
      return p >= 100 ? "Offen" : `Offen, ${p} %`;
    }
  }
  if (st.state !== "open" && st.state !== "closed") return "Zustand unbekannt";
  const when = typeof st.lc_ts === "number" ? ` ${hhmm(st.lc_ts)}` : "";
  return `zuletzt ${coverArrow(st.state)}${when}`;
}

/** Start screen summary of several covers: "beide ▲ 07:30" or "Treppe ▲, Schacht ▼". */
export function coversSummary(covers: { short: string; st: EntityState | undefined }[]): string {
  const known = covers.filter((c) => c.st && c.st.state !== "unavailable");
  if (!known.length) return "Offline";
  const arrows = known.map((c) => (coverMoving(c.st!.state) ? `fährt ${coverArrow(c.st!.state)}` : coverArrow(c.st!.state)));
  const same = arrows.every((a) => a === arrows[0]);
  if (same && known.length === covers.length) {
    const latest = Math.max(...known.map((c) => (typeof c.st!.lc_ts === "number" ? c.st!.lc_ts : 0)));
    const word = covers.length === 2 ? "beide" : "alle";
    return `${word} ${arrows[0]}${latest > 0 && arrows[0].length === 1 ? " " + hhmm(latest) : ""}`;
  }
  return covers
    .map((c) => `${c.short} ${c.st && c.st.state !== "unavailable" ? (coverMoving(c.st.state) ? "fährt " : "") + coverArrow(c.st.state) : "offline"}`)
    .join(", ");
}
