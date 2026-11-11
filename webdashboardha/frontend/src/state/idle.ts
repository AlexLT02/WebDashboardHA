/**
 * Inactivity (04 §5.6, 02 §6): 60 s without touch -> back to Start, popups
 * close after 30 s. Paused while a finger is down, a slider is dragged, the
 * keyboard is open, a warning is shown or editing runs.
 */
import { useEffect, useRef } from "react";

export const RETURN_MS = 60000;
export const POPUP_MS = 30000;

let lastActivity = Date.now();
let fingers = 0;
const pauses: Record<string, boolean> = {};

export function markActivity(): void {
  lastActivity = Date.now();
}

export function pauseIdle(reason: string): void {
  pauses[reason] = true;
  markActivity();
}

export function resumeIdle(reason: string): void {
  delete pauses[reason];
  markActivity();
}

export function idlePaused(): boolean {
  if (fingers > 0) return true;
  for (const k in pauses) if (pauses[k]) return true;
  return false;
}

/** Milliseconds since the last touch, 0 while paused. */
export function idleFor(): number {
  return idlePaused() ? 0 : Date.now() - lastActivity;
}

/** Document listeners; call once at startup. */
export function installIdleTracking(): () => void {
  const start = (e: TouchEvent) => {
    fingers = e.touches.length;
    markActivity();
  };
  const end = (e: TouchEvent) => {
    fingers = e.touches.length;
    markActivity();
  };
  const other = () => markActivity();
  const focusIn = (e: FocusEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) pauseIdle("keyboard");
  };
  const focusOut = () => resumeIdle("keyboard");
  document.addEventListener("touchstart", start, { capture: true, passive: true });
  document.addEventListener("touchend", end, { capture: true, passive: true });
  document.addEventListener("touchcancel", end, { capture: true, passive: true });
  document.addEventListener("mousedown", other, true);
  document.addEventListener("keydown", other, true);
  document.addEventListener("focusin", focusIn, true);
  document.addEventListener("focusout", focusOut, true);
  return () => {
    document.removeEventListener("touchstart", start, true);
    document.removeEventListener("touchend", end, true);
    document.removeEventListener("touchcancel", end, true);
    document.removeEventListener("mousedown", other, true);
    document.removeEventListener("keydown", other, true);
    document.removeEventListener("focusin", focusIn, true);
    document.removeEventListener("focusout", focusOut, true);
  };
}

/**
 * Calls `onIdle` after `ms` without activity (re-armed after each call).
 * One timeout per consumer, no per-tile intervals.
 */
export function useIdleTimer(ms: number, onIdle: () => void, enabled = true): void {
  const cb = useRef(onIdle);
  cb.current = onIdle;
  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    // Fire once per idle period: only again after new activity.
    let firedFor = -1;
    const startedAt = Date.now();
    const arm = (delay: number) => {
      timer = window.setTimeout(() => {
        const idle = Math.min(idleFor(), Date.now() - startedAt);
        if (idle >= ms) {
          if (lastActivity !== firedFor) {
            firedFor = lastActivity;
            cb.current();
          }
          arm(ms);
        } else {
          arm(ms - idle + 50);
        }
      }, delay);
    };
    arm(ms);
    return () => window.clearTimeout(timer);
  }, [ms, enabled]);
}
