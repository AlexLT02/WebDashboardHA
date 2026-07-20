import { useCallback, useEffect, useRef, useState } from "react";
import { clamp, eventPoint } from "./pointer";
import "./DragBar.css";

interface Props {
  /** Aktueller Wert [0..1]. */
  value: number;
  /** Beim Ziehen laufend (Live-Vorschau). */
  onInput?: (value: number) => void;
  /** Beim Loslassen (finaler Wert → HA). */
  onChange: (value: number) => void;
  /** "fill" = Füllbalken (Helligkeit), "pick" = voller Verlauf + Positions-Thumb (Farbe/Weißton). */
  mode: "fill" | "pick";
  /** Hintergrund des Füllbalkens (fill) bzw. des Tracks (pick). */
  gradient: string;
  height?: number;
  "aria-label"?: string;
}

/**
 * Horizontaler Touch/Maus-Regler. Ersetzt <input type=range> (auf iOS-12-Safari
 * unzuverlässig). Optimistisch: der gesetzte Wert bleibt stehen, bis HA ihn
 * bestätigt — kein Zurückspringen.
 */
export function DragBar({ value, onInput, onChange, mode, gradient, height = 46, ...aria }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [local, setLocal] = useState(value);
  const pendingRef = useRef<number | null>(null);
  const pendingTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (dragging) return;
    const pending = pendingRef.current;
    if (pending === null) {
      setLocal(value);
    } else if (Math.abs(value - pending) < 0.03) {
      pendingRef.current = null;
      setLocal(value);
    }
  }, [value, dragging]);

  useEffect(() => () => window.clearTimeout(pendingTimer.current), []);

  const valueFromEvent = useCallback((e: TouchEvent | MouseEvent): number => {
    const track = trackRef.current;
    const p = eventPoint(e);
    if (!track || !p) return local;
    const rect = track.getBoundingClientRect();
    return clamp((p.x - rect.left) / rect.width, 0, 1);
  }, [local]);

  const commit = useCallback(
    (v: number) => {
      setLocal(v);
      pendingRef.current = v;
      window.clearTimeout(pendingTimer.current);
      pendingTimer.current = window.setTimeout(() => {
        pendingRef.current = null;
      }, 3000);
      onChange(v);
    },
    [onChange],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: TouchEvent | MouseEvent) => {
      if (e.cancelable) e.preventDefault();
      const v = valueFromEvent(e);
      setLocal(v);
      onInput?.(v);
    };
    const up = (e: TouchEvent | MouseEvent) => {
      commit(valueFromEvent(e));
      setDragging(false);
    };
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [dragging, valueFromEvent, onInput, commit]);

  const start = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const v = valueFromEvent(e.nativeEvent as TouchEvent | MouseEvent);
    setLocal(v);
    setDragging(true);
    onInput?.(v);
  };

  const pct = Math.round(clamp(local, 0, 1) * 100);

  return (
    <div
      ref={trackRef}
      className={`dragbar dragbar--${mode}`}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={aria["aria-label"]}
      onTouchStart={start}
      onMouseDown={start}
      style={{ height, background: mode === "pick" ? gradient : undefined }}
    >
      {mode === "fill" ? (
        <div className="dragbar__fill" style={{ width: `${pct}%`, background: gradient }} />
      ) : (
        <div className="dragbar__thumb" style={{ left: `${pct}%` }} />
      )}
    </div>
  );
}
