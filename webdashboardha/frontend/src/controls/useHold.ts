import { useTap } from "./useTap";

/** Hold-to-trigger (02 §3): Alles aus 600 ms, critical socket off 1 s. */
export const HOLD_ALL_OFF_MS = 600;
export const HOLD_CRITICAL_MS = 1000;

/**
 * The element gets `is-holding` while the finger is down (CSS fills it from
 * the left after 150 ms), `is-fired` briefly when it triggers. Releasing early
 * calls `onShort` so the control can teach the gesture.
 */
export function useHold(ms: number, onFire: () => void, onShort?: () => void): (el: HTMLElement | null) => void {
  return useTap({
    hold: { ms, onFire, onShort, zone: "all" },
    pressSelector: undefined,
  });
}
