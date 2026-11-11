/**
 * Global touch guards (02 §3 "Schutz gegen Streifen", §8 Geisterklicks):
 * - input lock for 300 ms after every layer or page change,
 * - mouse events are ignored for 800 ms after any touch (iOS ghost clicks),
 * - a tap that stops a running scroll does not count (150 ms).
 */

let lockedUntil = 0;
let lastTouch = 0;
let lastScroll = 0;

export const LOCK_MS = 300;
export const GHOST_MOUSE_MS = 800;
export const SCROLL_GUARD_MS = 150;

export function lockInput(ms = LOCK_MS): void {
  lockedUntil = Math.max(lockedUntil, Date.now() + ms);
}

export function inputLocked(): boolean {
  return Date.now() < lockedUntil;
}

export function ghostMouse(): boolean {
  return Date.now() - lastTouch < GHOST_MOUSE_MS;
}

/** A scroll happened less than 150 ms before `t`, or after it. */
export function scrolledSince(t: number): boolean {
  return lastScroll >= t - SCROLL_GUARD_MS;
}

/** A scroll happened at or after `t` (during the gesture). */
export function scrolledAfter(t: number): boolean {
  return lastScroll >= t;
}

/** Document-level listeners; call once at startup. */
export function installGlobalGuards(): () => void {
  const touch = () => {
    lastTouch = Date.now();
  };
  const scroll = () => {
    lastScroll = Date.now();
  };
  // iOS ignores user-scalable=no since iOS 10: block pinch zoom explicitly.
  const gesture = (e: Event) => e.preventDefault();
  document.addEventListener("touchstart", touch, { capture: true, passive: true });
  document.addEventListener("touchend", touch, { capture: true, passive: true });
  document.addEventListener("scroll", scroll, { capture: true, passive: true });
  document.addEventListener("gesturestart", gesture, { passive: false });
  return () => {
    document.removeEventListener("touchstart", touch, { capture: true } as EventListenerOptions);
    document.removeEventListener("touchend", touch, { capture: true } as EventListenerOptions);
    document.removeEventListener("scroll", scroll, { capture: true } as EventListenerOptions);
    document.removeEventListener("gesturestart", gesture);
  };
}
