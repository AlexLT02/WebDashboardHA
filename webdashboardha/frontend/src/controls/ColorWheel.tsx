import { useCallback, useEffect, useRef, useState } from "react";
import { clamp, eventPoint } from "./pointer";
import "./ColorWheel.css";

interface Props {
  /** Farbton 0..360. */
  hue: number;
  /** Sättigung 0..100. */
  saturation: number;
  /** Finaler Wert beim Loslassen (→ HA). */
  onChange: (hue: number, saturation: number) => void;
  /** Live-Vorschau beim Ziehen. */
  onInput?: (hue: number, saturation: number) => void;
  size?: number;
  disabled?: boolean;
}

/** HSV→RGB mit value=1 (volle Helligkeit fürs Rad). */
function hsvToRgb(h: number, s: number): [number, number, number] {
  const c = s;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hh < 1) [r, g, b] = [c, x, 0];
  else if (hh < 2) [r, g, b] = [x, c, 0];
  else if (hh < 3) [r, g, b] = [0, c, x];
  else if (hh < 4) [r, g, b] = [0, x, c];
  else if (hh < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = 1 - c;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function ColorWheel({
  hue,
  saturation,
  onChange,
  onInput,
  size = 180,
  disabled,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState(false);
  const [local, setLocal] = useState({ h: hue, s: saturation });
  // Optimistisch gesetzte Farbe halten, bis HA sie bestätigt (kein Zurückspringen).
  const pendingRef = useRef<{ h: number; s: number } | null>(null);
  const pendingTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (dragging) return;
    const pending = pendingRef.current;
    if (pending === null) {
      setLocal({ h: hue, s: saturation });
      return;
    }
    // Hue-Differenz mit Wrap-around (359° ≈ 1°).
    const hueDiff = Math.min(Math.abs(hue - pending.h), 360 - Math.abs(hue - pending.h));
    if (hueDiff < 6 && Math.abs(saturation - pending.s) < 6) {
      pendingRef.current = null;
      setLocal({ h: hue, s: saturation });
    }
    // sonst: alten Store-Wert ignorieren, gesetzte Farbe weiter zeigen.
  }, [hue, saturation, dragging]);

  const commit = useCallback(
    (h: number, s: number) => {
      setLocal({ h, s });
      pendingRef.current = { h, s };
      window.clearTimeout(pendingTimer.current);
      pendingTimer.current = window.setTimeout(() => {
        pendingRef.current = null;
      }, 3000);
      onChange(h, s);
    },
    [onChange],
  );

  useEffect(() => () => window.clearTimeout(pendingTimer.current), []);

  // Rad einmalig zeichnen (pixelweise — kein conic-gradient auf iOS 12).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // In Geräteauflösung zeichnen (Retina = 2×), sonst wirkt das Rad stufig/pixelig.
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const dim = Math.round(size * dpr);
    canvas.width = dim;
    canvas.height = dim;

    const r = dim / 2;
    const img = ctx.createImageData(dim, dim);
    const data = img.data;
    for (let y = 0; y < dim; y++) {
      for (let x = 0; x < dim; x++) {
        const dx = x - r;
        const dy = y - r;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const idx = (y * dim + x) * 4;
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (angle < 0) angle += 360;
        // Volle Fläche füllen (Ecken clippt CSS border-radius) → glatte runde Kante.
        const sat = clamp(dist / r, 0, 1);
        const [rr, gg, bb] = hsvToRgb(angle, sat);
        data[idx] = rr;
        data[idx + 1] = gg;
        data[idx + 2] = bb;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [size]);

  const valueFromEvent = useCallback(
    (e: TouchEvent | MouseEvent): { h: number; s: number } => {
      const canvas = canvasRef.current;
      const p = eventPoint(e);
      if (!canvas || !p) return local;
      const rect = canvas.getBoundingClientRect();
      const r = rect.width / 2;
      const dx = p.x - rect.left - r;
      const dy = p.y - rect.top - r;
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      const s = clamp(Math.sqrt(dx * dx + dy * dy) / r, 0, 1) * 100;
      return { h: angle, s };
    },
    [local],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: TouchEvent | MouseEvent) => {
      e.preventDefault();
      const v = valueFromEvent(e);
      setLocal(v);
      onInput?.(v.h, v.s);
    };
    const up = (e: TouchEvent | MouseEvent) => {
      const v = valueFromEvent(e);
      commit(v.h, v.s); // pendingRef setzen, bevor dragging=false den Sync auslöst
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
    if (disabled) return;
    e.preventDefault();
    const v = valueFromEvent(e.nativeEvent as TouchEvent | MouseEvent);
    setLocal(v);
    setDragging(true);
    onInput?.(v.h, v.s);
  };

  // Knopf-Position aus lokalem HS.
  const r = size / 2;
  const rad = (local.h * Math.PI) / 180;
  const dist = (local.s / 100) * r;
  const knobX = r + dist * Math.cos(rad);
  const knobY = r + dist * Math.sin(rad);

  return (
    <div
      className={`color-wheel${disabled ? " is-disabled" : ""}`}
      style={{ width: size, height: size }}
      onTouchStart={start}
      onMouseDown={start}
    >
      <canvas ref={canvasRef} style={{ width: size, height: size }} />
      <div className="color-wheel__knob" style={{ left: knobX, top: knobY }} />
    </div>
  );
}
