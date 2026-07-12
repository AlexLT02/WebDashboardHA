/**
 * Einheitliche Positionsermittlung für Touch UND Maus.
 *
 * iOS-12-Safari kennt KEINE Pointer Events (erst iOS 13). Darum arbeiten die
 * Controls mit touch*- und mouse*-Events und normalisieren die Koordinaten hier.
 */
export interface Point {
  x: number;
  y: number;
}

export function eventPoint(e: TouchEvent | MouseEvent): Point | null {
  if ("touches" in e) {
    const t = e.touches[0] ?? e.changedTouches[0];
    if (!t) return null;
    return { x: t.clientX, y: t.clientY };
  }
  return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
}

/** clamp auf [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
