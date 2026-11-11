import { create } from "zustand";

/**
 * One clock for the whole app (04 §5.6 "ein minutengenauer Timer für alles").
 *
 * `now()` may be shifted in dev/mock via `?now=<ISO>` (deep link) so renders
 * can reproduce the mockup times. In production the offset is always 0.
 */
let offsetMs = 0;

export function setClockOffset(ms: number): void {
  offsetMs = ms;
}

export function now(): number {
  return Date.now() + offsetMs;
}

interface MinuteStore {
  /** Epoch ms of the current minute start; changes once per minute. */
  minute: number;
}

function minuteOf(ms: number): number {
  return ms - (ms % 60000);
}

export const useMinuteStore = create<MinuteStore>(() => ({ minute: minuteOf(now()) }));

let timer: number | undefined;

/** Starts the single minute timer (aligned to the minute boundary). */
export function startMinuteClock(): () => void {
  const tick = () => {
    useMinuteStore.setState({ minute: minuteOf(now()) });
    timer = window.setTimeout(tick, 60000 - (now() % 60000) + 50);
  };
  useMinuteStore.setState({ minute: minuteOf(now()) });
  timer = window.setTimeout(tick, 60000 - (now() % 60000) + 50);
  return () => window.clearTimeout(timer);
}

/** Re-renders the caller once per minute; returns the shifted "now" in ms. */
export function useMinute(): number {
  useMinuteStore((s) => s.minute);
  return now();
}
