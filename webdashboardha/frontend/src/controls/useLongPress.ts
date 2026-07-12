import { useCallback, useRef } from "react";
import { eventPoint } from "./pointer";

interface Options {
  onTap: () => void;
  onLongPress: () => void;
  delay?: number; // ms bis Long-Press (Default 600)
  moveTolerance?: number; // px, ab denen es als Scroll/Drag gilt
}

interface Handlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
}

/**
 * Unterscheidet Tippen von 1s-Halten — für Touch UND Maus (iOS 12 kennt keine
 * Pointer Events). Bewegt sich der Finger zu weit, gilt es als Scroll und wird
 * verworfen. Nach ausgelöstem Long-Press wird der Tap unterdrückt.
 */
export function useLongPress({
  onTap,
  onLongPress,
  delay = 600,
  moveTolerance = 12,
}: Options): Handlers {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const longFired = useRef(false);
  const active = useRef<"touch" | "mouse" | null>(null);

  const clear = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  const begin = useCallback(
    (e: TouchEvent | MouseEvent, kind: "touch" | "mouse") => {
      active.current = kind;
      longFired.current = false;
      start.current = eventPoint(e);
      clear();
      timer.current = window.setTimeout(() => {
        longFired.current = true;
        onLongPress();
      }, delay);
    },
    [clear, delay, onLongPress],
  );

  const move = useCallback(
    (e: TouchEvent | MouseEvent) => {
      if (!start.current) return;
      const p = eventPoint(e);
      if (!p) return;
      if (
        Math.abs(p.x - start.current.x) > moveTolerance ||
        Math.abs(p.y - start.current.y) > moveTolerance
      ) {
        // Zu viel Bewegung → Scroll/Drag, kein Tap/Long-Press.
        clear();
        start.current = null;
      }
    },
    [clear, moveTolerance],
  );

  const end = useCallback(() => {
    clear();
    if (start.current && !longFired.current) onTap();
    start.current = null;
    active.current = null;
  }, [clear, onTap]);

  return {
    onTouchStart: (e) => begin(e.nativeEvent, "touch"),
    onTouchMove: (e) => move(e.nativeEvent),
    onTouchEnd: () => end(),
    // Maus nur, wenn nicht gerade ein Touch läuft (verhindert Ghost-Events).
    onMouseDown: (e) => {
      if (active.current === "touch") return;
      begin(e.nativeEvent, "mouse");
    },
    onMouseMove: (e) => {
      if (active.current === "mouse") move(e.nativeEvent);
    },
    onMouseUp: () => {
      if (active.current === "mouse") end();
    },
    onMouseLeave: () => {
      if (active.current === "mouse") {
        clear();
        start.current = null;
        active.current = null;
      }
    },
  };
}
