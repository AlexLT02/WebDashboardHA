import { useCallback, useEffect, useRef, useState } from "react";
import { clamp, eventPoint } from "./pointer";
import "./TouchSlider.css";

interface Props {
  /** Aktueller Wert [0..1]. */
  value: number;
  /** Wird beim Ziehen laufend aufgerufen (Live-Vorschau). */
  onInput?: (value: number) => void;
  /** Wird beim Loslassen aufgerufen (finaler Wert → HA). */
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Optionale Maße (Default 64×160). Für den großen Dialog-Balken größer setzen. */
  width?: number;
  height?: number;
  /** Optionale Füll-Farbe/Gradient (Default: blauer Helligkeits-Verlauf).
   *  Für die Weißtemperatur z. B. ein Warm→Kalt-Verlauf. */
  fillBackground?: string;
  /** Wenn gesetzt: kompletter Verlauf ist als Track sichtbar und ein
   *  Positions-Balken markiert die Auswahl (statt Füllbalken). Zum Auswählen
   *  einer Farbe/Temperatur auf dem Verlauf. */
  trackGradient?: string;
  /** Prozent-Label anzeigen (Default true, außer bei trackGradient). */
  showLabel?: boolean;
  "aria-label"?: string;
}

/**
 * Vertikaler Helligkeits-Slider auf Touch/Maus-Basis.
 * Ersetzt <input type=range>, das auf iOS-12-Safari unzuverlässig ist.
 */
export function TouchSlider({
  value,
  onInput,
  onChange,
  disabled,
  width,
  height,
  fillBackground,
  trackGradient,
  showLabel,
  ...aria
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [local, setLocal] = useState(value);
  // Optimistisch gesetzter Wert: bis HA ihn bestätigt, ignorieren wir den
  // (noch alten) Store-Wert — sonst springt der Regler kurz zurück.
  const pendingRef = useRef<number | null>(null);
  const pendingTimer = useRef<number | undefined>(undefined);

  // Externe (Store-)Updates übernehmen, solange der Nutzer nicht zieht — aber
  // einen offenen optimistischen Wert nicht durch den alten Stand überschreiben.
  useEffect(() => {
    if (dragging) return;
    const pending = pendingRef.current;
    if (pending === null) {
      setLocal(value);
    } else if (Math.abs(value - pending) < 0.02) {
      // HA hat den gesetzten Wert bestätigt → wieder Store folgen.
      pendingRef.current = null;
      setLocal(value);
    }
    // sonst: alten Store-Wert ignorieren, optimistischen Wert weiter zeigen.
  }, [value, dragging]);

  const commit = useCallback(
    (v: number) => {
      setLocal(v);
      pendingRef.current = v;
      window.clearTimeout(pendingTimer.current);
      // Fallback: nach 3 s wieder dem Store folgen, falls keine Bestätigung kommt.
      pendingTimer.current = window.setTimeout(() => {
        pendingRef.current = null;
      }, 3000);
      onChange(v);
    },
    [onChange],
  );

  useEffect(() => () => window.clearTimeout(pendingTimer.current), []);

  const valueFromEvent = useCallback((e: TouchEvent | MouseEvent): number => {
    const track = trackRef.current;
    const p = eventPoint(e);
    if (!track || !p) return local;
    const rect = track.getBoundingClientRect();
    // Oben = 1, unten = 0.
    const ratio = 1 - (p.y - rect.top) / rect.height;
    return clamp(ratio, 0, 1);
  }, [local]);

  useEffect(() => {
    if (!dragging) return;

    const move = (e: TouchEvent | MouseEvent) => {
      e.preventDefault();
      const v = valueFromEvent(e);
      setLocal(v);
      onInput?.(v);
    };
    const up = (e: TouchEvent | MouseEvent) => {
      const v = valueFromEvent(e);
      commit(v); // pendingRef setzen, BEVOR dragging=false den Sync-Effekt auslöst
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
    onInput?.(v);
  };

  const pct = Math.round(local * 100);

  return (
    <div
      ref={trackRef}
      className={`touch-slider${disabled ? " is-disabled" : ""}`}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={aria["aria-label"]}
      onTouchStart={start}
      onMouseDown={start}
      style={{ width, height, background: trackGradient }}
    >
      {trackGradient ? (
        // Voller Verlauf sichtbar, Positions-Balken markiert die Auswahl.
        <div className="touch-slider__indicator" style={{ top: `${100 - pct}%` }} />
      ) : (
        <>
          <div
            className="touch-slider__fill"
            style={{ height: `${pct}%`, background: fillBackground }}
          />
          {showLabel !== false && <span className="touch-slider__label">{pct}%</span>}
        </>
      )}
    </div>
  );
}
