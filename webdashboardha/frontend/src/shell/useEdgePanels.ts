import { useEffect, useRef, useState, type RefObject } from "react";

interface EdgePanels {
  leftOpen: boolean;
  openLeft: () => void;
  close: () => void;
}

/**
 * Steuer-Panel per Wisch vom linken Bildschirmrand öffnen (wie im Design),
 * plus Schließen durch Antippen außerhalb. Touch UND Maus (Safari 12 kennt
 * keine Pointer Events).
 */
export function useEdgePanels(rootRef: RefObject<HTMLElement | null>): EdgePanels {
  const [leftOpen, setLeftOpen] = useState(false);

  const openRef = useRef(false);
  openRef.current = leftOpen;

  const openLeft = () => setLeftOpen(true);
  const close = () => setLeftOpen(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const EDGE = 40; // px vom Rand, in denen ein Wisch startet
    const THRESH = 22; // px, ab denen der Wisch als Öffnen gilt
    let sx: number | null = null;
    let onEdge = false;

    const inPanel = (t: EventTarget | null) =>
      t instanceof Element && !!t.closest("[data-panel]");
    const rect = () => root.getBoundingClientRect();

    const down = (cx: number, target: EventTarget | null) => {
      if (openRef.current) {
        if (!inPanel(target)) close();
        sx = null;
        onEdge = false;
        return;
      }
      const r = rect();
      const x = cx - r.left;
      sx = x;
      onEdge = x <= EDGE;
    };
    const move = (cx: number) => {
      if (sx == null || !onEdge) return;
      const r = rect();
      const d = cx - r.left - sx;
      if (d > THRESH) {
        openLeft();
        sx = null;
        onEdge = false;
      }
    };
    const up = () => {
      sx = null;
      onEdge = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) down(t.clientX, e.target);
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) move(t.clientX);
    };
    const onMouseDown = (e: MouseEvent) => down(e.clientX, e.target);
    const onMouseMove = (e: MouseEvent) => {
      if (e.buttons) move(e.clientX);
    };

    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: true });
    root.addEventListener("touchend", up);
    root.addEventListener("mousedown", onMouseDown);
    root.addEventListener("mousemove", onMouseMove);
    root.addEventListener("mouseup", up);
    return () => {
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", up);
      root.removeEventListener("mousedown", onMouseDown);
      root.removeEventListener("mousemove", onMouseMove);
      root.removeEventListener("mouseup", up);
    };
    // rootRef ist stabil; Handler lesen den offenen Zustand über openRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootRef]);

  return { leftOpen, openLeft, close };
}
