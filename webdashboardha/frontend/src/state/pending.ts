/**
 * Optimistic state (04 §5.3, 02 §5): show the target at once, confirm only when
 * HA reports it, fall back with "Keine Rückmeldung" after 5 s (8 s cloud/script)
 * or with "Fehlgeschlagen" on an HTTP error.
 *
 * The decision logic is pure (tested in pending.test.ts); the small zustand
 * store below only holds the records and the timers.
 */
import { create } from "zustand";
import { useStore } from "./store";
import { tileView } from "./tileState";
import type { Board, Item } from "./model";

export const TIMEOUT_LOCAL_MS = 5000;
export const TIMEOUT_CLOUD_MS = 8000;
export const FEEDBACK_MS = 4000;
export const FLASH_MS = 600;

export type Phase = "wait" | "failed" | "noresp";

export interface Pend {
  /** Desired "on" look of the tile. */
  on: boolean;
  phase: Phase;
  /** When the command went out (epoch ms). */
  at: number;
  /** Deadline of the current phase (epoch ms). */
  until: number;
}

/** Timeout for a command: cloud devices and scripts answer slower. */
export function timeoutFor(cloud: boolean, script = false): number {
  return cloud || script ? TIMEOUT_CLOUD_MS : TIMEOUT_LOCAL_MS;
}

export function startPend(on: boolean, now: number, cloud: boolean, script = false): Pend {
  return { on, phase: "wait", at: now, until: now + timeoutFor(cloud, script) };
}

/**
 * Next record for a pending command given what HA reports right now.
 * Returns null when the record is finished (confirmed or feedback over).
 */
export function resolvePend(p: Pend, observedOn: boolean, now: number): Pend | null {
  if (p.phase === "wait") {
    if (observedOn === p.on) return null;
    if (now >= p.until) return { ...p, phase: "noresp", until: now + FEEDBACK_MS };
    return p;
  }
  return now >= p.until ? null : p;
}

export function failPend(p: Pend, now: number): Pend {
  return { ...p, phase: "failed", until: now + FEEDBACK_MS };
}

/** Status line while a record is active. */
export function pendStatus(p: Pend): string {
  if (p.phase === "failed") return "Fehlgeschlagen";
  if (p.phase === "noresp") return "Keine Rückmeldung";
  return p.on ? "Schaltet ein …" : "Schaltet aus …";
}

// ---- tolerances for slider values (DragBar keeps its value until confirmed) ----

export type ValueKind = "brightness" | "kelvin" | "hue" | "saturation" | "position";

const TOLERANCE: Record<ValueKind, number> = {
  brightness: 3, // of 255
  kelvin: 50,
  hue: 3, // degrees
  saturation: 3, // percent
  position: 2, // percent
};

export function withinTolerance(kind: ValueKind, target: number, actual: number | null | undefined): boolean {
  if (actual === null || actual === undefined || !isFinite(actual)) return false;
  let d = Math.abs(target - actual);
  if (kind === "hue") d = Math.min(d, 360 - d);
  return d <= TOLERANCE[kind];
}

// ---- store -------------------------------------------------------------------

interface PendingStore {
  map: Record<string, Pend>;
  /** Short-lived red border (600 ms) per id. */
  flash: Record<string, boolean>;
}

export const usePending = create<PendingStore>(() => ({ map: {}, flash: {} }));

const items: Record<string, Item> = {};
const timers: Record<string, number> = {};
let boardRef: Board | null = null;

function setPend(id: string, p: Pend | null): void {
  const map = { ...usePending.getState().map };
  if (p) map[id] = p;
  else delete map[id];
  usePending.setState({ map });
  window.clearTimeout(timers[id]);
  if (p) timers[id] = window.setTimeout(() => check(id), Math.max(0, p.until - Date.now()) + 20);
}

function observedOn(id: string): boolean | null {
  const item = items[id];
  if (!item) return null;
  const s = useStore.getState();
  return tileView(item, {
    get: (e) => s.states[e],
    now: Date.now(),
    heating: boardRef?.heating,
    music: boardRef?.music,
  }).on;
}

function check(id: string): void {
  const p = usePending.getState().map[id];
  if (!p) return;
  const obs = observedOn(id);
  const next = resolvePend(p, obs === null ? p.on : obs, Date.now());
  if (next !== p) setPend(id, next);
}

/** Begin an optimistic command for an item tile. */
export function beginPending(item: Item, on: boolean, board: Board | null, script = false): void {
  items[item.id] = item;
  boardRef = board;
  setPend(item.id, startPend(on, Date.now(), item.cloud, script));
}

/** The command failed with an HTTP error: revert at once and say so. */
export function failPending(id: string): void {
  const p = usePending.getState().map[id];
  if (!p) return;
  setPend(id, failPend(p, Date.now()));
  usePending.setState({ flash: { ...usePending.getState().flash, [id]: true } });
  window.setTimeout(() => {
    const flash = { ...usePending.getState().flash };
    delete flash[id];
    usePending.setState({ flash });
  }, FLASH_MS);
}

// Confirm on every state change (only a handful of records exist at a time).
useStore.subscribe((s, prev) => {
  if (s.states === prev.states) return;
  const map = usePending.getState().map;
  for (const id in map) if (map[id].phase === "wait") check(id);
});

export function usePend(id: string): Pend | undefined {
  return usePending((s) => s.map[id]);
}

export function useFlash(id: string): boolean {
  return usePending((s) => !!s.flash[id]);
}
