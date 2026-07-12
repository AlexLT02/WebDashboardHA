import { useEffect, useState } from "react";

export interface Viewport {
  width: number;
  height: number;
}

/**
 * Aktuelle Viewport-Größe, aktualisiert bei Resize/Rotation.
 * Ersatz für CSS clamp()/min()/max(), die es auf Safari 12 (iPad Air 1) nicht gibt —
 * responsive Control-Größen rechnen wir stattdessen in JS.
 */
export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() =>
        setVp({ width: window.innerWidth, height: window.innerHeight }),
      );
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  return vp;
}

/** clamp in JS (da CSS clamp() auf Safari 12 fehlt). */
export function clampNum(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Ungefähre Pixelgröße einer Rasterzelle (w×h) im 6-spaltigen Dashboard —
 *  für größenabhängig skalierende Inhalte (Uhr, Panels). */
export function useCellBox(w: number, h: number): { boxW: number; boxH: number } {
  const vp = useViewport();
  const cols = 6;
  const gap = 10;
  const containerW = Math.min(vp.width, 1280) - 24;
  const cellW = (containerW - gap * (cols - 1)) / cols;
  return {
    boxW: Math.max(0, w * cellW + (w - 1) * gap),
    boxH: h * 76 + (h - 1) * gap,
  };
}
