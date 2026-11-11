import { useCallback, useRef } from "react";
import { ghostMouse, inputLocked, scrolledAfter, scrolledSince } from "./inputLock";

/**
 * Tap / hold gestures for tiles, chips and buttons (04 §5.3, 02 §3).
 *
 * Fired on `touchend`, so sliding off cancels. Guards:
 * movement > 10 px cancels, a second finger discards the gesture, a tap that
 * stops a scroll (scroll < 150 ms before or during) does not count, the same
 * target within 350 ms is ignored, the global 300 ms input lock is respected and
 * mouse events right after a touch are ignored (ghost clicks).
 *
 * Native listeners: React registers touch listeners passive, so preventDefault
 * in onTouchEnd would be ignored. We call it in a native `{passive:false}`
 * listener so iOS does not synthesize mouse events onto whatever appears
 * under the finger (popup opened by holding).
 */

export const MOVE_PX = 10;
export const HOLD_MS = 500;
export const DEBOUNCE_MS = 350;

export type TapZone = "icon" | "body";

export interface HoldCfg {
  ms: number;
  /** Fires while the finger is still down. */
  onFire: () => void;
  /** Released before `ms`. */
  onShort?: () => void;
  /** Where the hold applies: icon zone only or the whole element. */
  zone: "icon" | "all";
}

export interface TapCfg {
  onTap?: (zone: TapZone) => void;
  /** Width of the icon zone from the left edge; 0 = none. */
  iconWidth?: number;
  /** 0.5 s hold anywhere (popup). Not used where a `hold` covers the touch. */
  onLongPress?: () => void;
  hold?: HoldCfg | null;
  /** Element (selector inside the root) that gets `is-press` on touchstart. */
  pressSelector?: string;
  /** Only add `is-press` when the touch starts in the icon zone. */
  pressIconOnly?: boolean;
  disabled?: boolean;
}

interface Gesture {
  x: number;
  y: number;
  t: number;
  zone: TapZone;
  valid: boolean;
  fired: boolean;
  holding: boolean;
  timer: number | undefined;
  source: "touch" | "mouse";
}

function pointOf(e: TouchEvent | MouseEvent): { x: number; y: number } | null {
  if ("changedTouches" in e) {
    const t = e.touches[0] || e.changedTouches[0];
    return t ? { x: t.clientX, y: t.clientY } : null;
  }
  return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
}

/** Returns a ref callback; attach it to the element that receives the gesture. */
export function useTap(cfg: TapCfg): (el: HTMLElement | null) => void {
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const elRef = useRef<HTMLElement | null>(null);
  const detachRef = useRef<(() => void) | null>(null);

  const attach = useCallback((el: HTMLElement) => {
    let g: Gesture | null = null;
    let lastFire = 0;

    const pressEl = (): Element | null => {
      const sel = cfgRef.current.pressSelector;
      if (!sel) return null;
      return sel === ":self" ? el : el.querySelector(sel);
    };
    const setPress = (on: boolean) => {
      const p = pressEl();
      if (p) p.classList[on ? "add" : "remove"]("is-press");
    };
    const setHolding = (on: boolean) => el.classList[on ? "add" : "remove"]("is-holding");

    const clear = () => {
      if (!g) return;
      window.clearTimeout(g.timer);
      setPress(false);
      if (g.holding) setHolding(false);
      g = null;
    };

    const begin = (e: TouchEvent | MouseEvent, source: "touch" | "mouse") => {
      const c = cfgRef.current;
      const target = e.target as Element | null;
      // Nested controls with their own gesture (cover buttons) are not ours.
      const own = target && target.closest ? target.closest("[data-own]") : null;
      if (c.disabled || (own && own !== el && el.contains(own))) {
        g = null;
        return;
      }
      const p = pointOf(e);
      if (!p) return;
      const rect = el.getBoundingClientRect();
      const iconW = c.iconWidth || 0;
      const zone: TapZone = iconW > 0 && p.x - rect.left < iconW ? "icon" : "body";
      const now = Date.now();
      const valid = !inputLocked() && !scrolledSince(now);
      g = { x: p.x, y: p.y, t: now, zone, valid, fired: false, holding: false, timer: undefined, source };
      if (!valid) return;
      if (!c.pressIconOnly || zone === "icon") setPress(true);
      const hold = c.hold && (c.hold.zone === "all" || zone === "icon") ? c.hold : null;
      if (hold) {
        g.holding = true;
        setHolding(true);
        g.timer = window.setTimeout(() => {
          if (!g || !g.valid) return;
          g.fired = true;
          setHolding(false);
          setPress(false);
          el.classList.add("is-fired");
          window.setTimeout(() => el.classList.remove("is-fired"), 200);
          hold.onFire();
        }, hold.ms);
      } else if (c.onLongPress) {
        const onLong = c.onLongPress;
        g.timer = window.setTimeout(() => {
          if (!g || !g.valid) return;
          g.fired = true;
          setPress(false);
          onLong();
        }, HOLD_MS);
      }
    };

    const invalidate = () => {
      if (!g) return;
      g.valid = false;
      window.clearTimeout(g.timer);
      setPress(false);
      if (g.holding) setHolding(false);
    };

    const move = (e: TouchEvent | MouseEvent) => {
      if (!g || !g.valid) return;
      if ("touches" in e && e.touches.length > 1) return invalidate();
      const p = pointOf(e);
      if (p && (Math.abs(p.x - g.x) > MOVE_PX || Math.abs(p.y - g.y) > MOVE_PX)) invalidate();
    };

    const end = (e: TouchEvent | MouseEvent) => {
      const cur = g;
      clear();
      if (!cur || !cur.valid || cur.fired) return;
      const now = Date.now();
      if (cur.source === "touch" && scrolledAfter(cur.t)) return;
      const p = pointOf(e);
      if (p && (Math.abs(p.x - cur.x) > MOVE_PX || Math.abs(p.y - cur.y) > MOVE_PX)) return;
      if (now - lastFire < DEBOUNCE_MS) return;
      lastFire = now;
      const c = cfgRef.current;
      const hold = c.hold && (c.hold.zone === "all" || cur.zone === "icon") ? c.hold : null;
      if (hold) {
        if (hold.onShort) hold.onShort();
        return;
      }
      if (c.onTap) c.onTap(cur.zone);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        invalidate();
        return;
      }
      begin(e, "touch");
    };
    const onTouchMove = (e: TouchEvent) => move(e);
    const onTouchEnd = (e: TouchEvent) => {
      if (g && e.cancelable) e.preventDefault();
      end(e);
    };
    const onTouchCancel = () => clear();
    const onMouseDown = (e: MouseEvent) => {
      if (ghostMouse() || e.button !== 0) return;
      begin(e, "mouse");
    };
    const onMouseMove = (e: MouseEvent) => {
      if (g && g.source === "mouse") move(e);
    };
    const onMouseUp = (e: MouseEvent) => {
      if (ghostMouse() || !g || g.source !== "mouse") return;
      end(e);
    };
    const onMouseLeave = () => {
      if (g && g.source === "mouse") clear();
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    el.addEventListener("touchcancel", onTouchCancel, { passive: true });
    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mouseup", onMouseUp);
    el.addEventListener("mouseleave", onMouseLeave);
    return () => {
      clear();
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  // No unmount effect: React calls the ref callback with null when the element
  // goes away, which detaches. (A cleanup effect would also run during the
  // StrictMode double mount and leave the element without listeners.)
  return useCallback(
    (el: HTMLElement | null) => {
      if (el === elRef.current) return;
      detachRef.current?.();
      detachRef.current = null;
      elRef.current = el;
      if (el) detachRef.current = attach(el);
    },
    [attach],
  );
}
