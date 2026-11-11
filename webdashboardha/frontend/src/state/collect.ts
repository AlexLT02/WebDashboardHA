/**
 * Tap collector (04 §5.5): several taps on + / − or Lauter / Leiser become ONE
 * service call, sent `ms` after the last tap. Tuya goes through the cloud and
 * every IR press runs a script, single calls per tap would queue up.
 *
 * Pure apart from the injected timer functions (tested with fake timers).
 */

export interface Collector<T> {
  /** Add a tap; (re)starts the quiet period. */
  push(value: T): void;
  /** Send what is collected right now (popup closes). */
  flush(): void;
  /** Drop what is collected without sending. */
  cancel(): void;
  /** Collected value that has not been sent yet. */
  current(): T | undefined;
}

export const COLLECT_MS = 800;

export function createCollector<T>(
  ms: number,
  reduce: (acc: T | undefined, value: T) => T,
  send: (acc: T) => void,
  timers: { set: (fn: () => void, ms: number) => number; clear: (id: number) => void } = {
    set: (fn, t) => window.setTimeout(fn, t),
    clear: (id) => window.clearTimeout(id),
  },
): Collector<T> {
  let acc: T | undefined;
  let timer: number | undefined;
  const flush = () => {
    if (timer !== undefined) timers.clear(timer);
    timer = undefined;
    if (acc === undefined) return;
    const v = acc;
    acc = undefined;
    send(v);
  };
  return {
    push(value) {
      acc = reduce(acc, value);
      if (timer !== undefined) timers.clear(timer);
      timer = timers.set(flush, ms);
    },
    flush,
    cancel() {
      if (timer !== undefined) timers.clear(timer);
      timer = undefined;
      acc = undefined;
    },
    current: () => acc,
  };
}

/**
 * Next set point for one + / − tap: the next grid value in that direction
 * (22,8 + 0,5 -> 23,0, 23,0 + 0,5 -> 23,5), clamped to [min, max].
 */
export function stepTarget(base: number, dir: 1 | -1, step: number, min: number, max: number): number {
  const s = step > 0 ? step : 0.5;
  const q = base / s;
  const next = dir > 0 ? (Math.floor(q + 1e-6) + 1) * s : (Math.ceil(q - 1e-6) - 1) * s;
  return Math.round(Math.max(min, Math.min(max, next)) * 100) / 100;
}
