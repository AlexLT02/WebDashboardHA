import { useEffect, useRef, useState, type RefObject } from "react";

interface EdgePanels {
  leftOpen: boolean;
  rightOpen: boolean;
  openLeft: () => void;
  openRight: () => void;
  close: () => void;
}

/**
 * Overlay-Panels per Wisch von den Bildschirmrändern öffnen (wie im Design),
 * plus Schließen durch Antippen außerhalb. Touch UND Maus (Safari 12 kennt
 * keine Pointer Events).
 */
export function useEdgePanels(rootRef: RefObject<HTMLElement | null>): EdgePanels {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const openRef = useRef({ left: false, right: false });
  openRef.current = { left: leftOpen, right: rightOpen };

  const openLeft = () => {
    setLeftOpen(true);
    setRightOpen(false);
  };
  const openRight = () => {
    setRightOpen(true);
    setLeftOpen(false);
  };
  const close = () => {
    setLeftOpen(false);
    setRightOpen(false);
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const EDGE = 40; // px vom Rand, in denen ein Wisch startet
    const THRESH = 22; // px, ab denen der Wisch als Öffnen gilt
    let sx: number | null = null;
    let edge: "left" | "right" | null = null;

    const inPanel = (t: EventTarget | null) =>
      t instanceof Element && !!t.closest("[data-panel]");
    const rect = () => root.getBoundingClientRect();

    const down = (cx: number, target: EventTarget | null) => {
      if (openRef.current.left || openRef.current.right) {
        if (!inPanel(target)) close();
        sx = null;
        edge = null;
        return;
      }
      const r = rect();
      const x = cx - r.left;
      sx = x;
      edge = x <= EDGE ? "left" : x >= r.width - EDGE ? "right" : null;
    };
    const move = (cx: number) => {
      if (sx == null || !edge) return;
      const r = rect();
      const d = cx - r.left - sx;
      if (edge === "left" && d > THRESH) {
        openLeft();
        sx = null;
        edge = null;
      } else if (edge === "right" && d < -THRESH) {
        openRight();
        sx = null;
        edge = null;
      }
    };
    const up = () => {
      sx = null;
      edge = null;
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

  return { leftOpen, rightOpen, openLeft, openRight, close };
}
