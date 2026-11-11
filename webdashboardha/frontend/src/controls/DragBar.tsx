import { useEffect, useRef, useState, type CSSProperties } from "react";
import { clamp } from "./pointer";
import { pauseIdle, resumeIdle } from "../state/idle";
import "./DragBar.css";

interface Props {
  /** Value reported by HA, 0..1 (null = unknown). */
  value: number | null;
  /** Send a value to HA (throttled while dragging, final on release). */
  onCommit: (value: number) => void;
  /** Live local value while dragging or waiting for confirmation (null = none). */
  onLocal?: (value: number | null) => void;
  /** 300 = send every 300 ms while dragging (local devices), 0 = only on release (cloud). */
  throttleMs: number;
  /** Is the reported value close enough to the sent one (tolerances 04 §5.3)? */
  confirm: (target: number, reported: number | null) => boolean;
  /** Give up waiting for confirmation (5 s local, 8 s cloud). */
  timeoutMs: number;
  mode: "fill" | "pick";
  /** Extra classes for the bar (`bar--k`, `bar--hue`). */
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  label?: string;
}

/**
 * Horizontal touch slider (replaces <input type=range>, unusable on iOS 12).
 * Native touchstart with {passive:false}: React's passive listeners cannot
 * stop the page from scrolling. The hit area is 56 px high even for 44 px bars.
 * Keeps the set value until HA confirms it, so the bar never jumps back.
 */
export function DragBar(p: Props) {
  const hitRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [local, setLocal] = useState<number | null>(null);
  const cfg = useRef(p);
  cfg.current = p;
  const st = useRef({ dragging: false, last: -1, sentAt: 0, waitUntil: 0, timer: 0 as number | undefined });

  const show = (v: number | null) => {
    setLocal(v);
    cfg.current.onLocal?.(v);
  };

  // Drop the local value once HA confirms it (or the wait times out).
  useEffect(() => {
    const s = st.current;
    if (s.dragging || local === null) return;
    if (p.confirm(local, p.value) || Date.now() > s.waitUntil) show(null);
  }, [p.value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = hitRef.current;
    if (!el) return;
    const s = st.current;
    const valueAt = (clientX: number): number => {
      const bar = barRef.current;
      if (!bar) return 0;
      const r = bar.getBoundingClientRect();
      return clamp((clientX - r.left) / r.width, 0, 1);
    };
    const send = (v: number, final: boolean) => {
      const c = cfg.current;
      if (Math.abs(v - s.last) < 0.004 && !final) return;
      if (final && Math.abs(v - s.last) < 0.004) return;
      s.last = v;
      s.sentAt = Date.now();
      c.onCommit(v);
    };
    let latest = 0;
    let trail: number | undefined;
    let finalTimer: number | undefined;
    const tick = () => {
      trail = undefined;
      const c = cfg.current;
      if (s.dragging && c.throttleMs > 0) send(latest, false);
    };
    const sendFinal = () => {
      finalTimer = undefined;
      send(latest, true);
    };
    const start = (x: number) => {
      if (cfg.current.disabled) return false;
      // A pending final value of the previous drag goes out first (keeps the order).
      if (finalTimer !== undefined) {
        window.clearTimeout(finalTimer);
        sendFinal();
      }
      s.dragging = true;
      s.last = -1;
      latest = valueAt(x);
      show(latest);
      pauseIdle("drag");
      const c = cfg.current;
      if (c.throttleMs > 0) send(latest, false);
      return true;
    };
    const moveTo = (x: number) => {
      latest = valueAt(x);
      show(latest);
      const c = cfg.current;
      if (c.throttleMs > 0 && trail === undefined) {
        const wait = Math.max(0, c.throttleMs - (Date.now() - s.sentAt));
        trail = window.setTimeout(tick, wait);
      }
    };
    const finish = () => {
      if (!s.dragging) return;
      s.dragging = false;
      window.clearTimeout(trail);
      trail = undefined;
      resumeIdle("drag");
      s.waitUntil = Date.now() + cfg.current.timeoutMs;
      // The final value also respects the throttle, so a drag never exceeds
      // one call per throttleMs (music: at most 4 per second, 04 §6 P4).
      const wait = cfg.current.throttleMs > 0 && s.last !== -1 ? cfg.current.throttleMs - (Date.now() - s.sentAt) : 0;
      if (wait > 0) finalTimer = window.setTimeout(sendFinal, wait);
      else send(latest, true);
      window.clearTimeout(s.timer);
      s.timer = window.setTimeout(() => {
        if (!s.dragging) show(null);
      }, cfg.current.timeoutMs + 50);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) return;
      if (start(e.touches[0].clientX) && e.cancelable) e.preventDefault();
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!s.dragging) return;
      if (e.cancelable) e.preventDefault();
      moveTo(e.touches[0].clientX);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (s.dragging && e.cancelable) e.preventDefault();
      finish();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (!start(e.clientX)) return;
      const mm = (ev: MouseEvent) => moveTo(ev.clientX);
      const mu = () => {
        window.removeEventListener("mousemove", mm);
        window.removeEventListener("mouseup", mu);
        finish();
      };
      window.addEventListener("mousemove", mm);
      window.addEventListener("mouseup", mu);
    };
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    el.addEventListener("touchcancel", onTouchEnd, { passive: false });
    el.addEventListener("mousedown", onMouseDown);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("mousedown", onMouseDown);
      window.clearTimeout(trail);
      window.clearTimeout(s.timer);
      // Popup closed right after release: the final value still goes out.
      if (finalTimer !== undefined) {
        window.clearTimeout(finalTimer);
        sendFinal();
      }
      if (s.dragging) resumeIdle("drag");
    };
  }, []);

  const shown = clamp(local !== null ? local : p.value !== null ? p.value : 0, 0, 1);
  const pctW = `${Math.round(shown * 1000) / 10}%`;

  return (
    <div
      ref={hitRef}
      className="barhit"
      role="slider"
      aria-label={p.label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(shown * 100)}
    >
      <div ref={barRef} className={`bar${p.className ? " " + p.className : ""}`} style={p.style}>
        {p.mode === "fill" ? (
          <div className="bar__fill" style={{ width: pctW }} />
        ) : (
          <i className="bar__mark" style={{ left: pctW }} />
        )}
      </div>
    </div>
  );
}
