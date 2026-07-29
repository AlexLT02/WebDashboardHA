/**
 * Rollladen-/Cover-Logik (HA-Domain `cover`): Fähigkeiten aus
 * `supported_features`, Position, Zustandstext und der Service für einen Tap.
 *
 * Bewusst frei von React/DOM → unit-testbar (siehe cover.test.ts).
 */

// Bitmaske aus HA `CoverEntityFeature`.
const FEATURE_OPEN = 1;
const FEATURE_CLOSE = 2;
const FEATURE_SET_POSITION = 4;
const FEATURE_STOP = 8;

export interface CoverFeatures {
  open: boolean;
  close: boolean;
  stop: boolean;
  setPosition: boolean;
}

export type CoverService = "open_cover" | "close_cover" | "stop_cover";

/**
 * Fähigkeiten eines Covers. Meldet die Integration gar keine Features
 * (`supported_features` fehlt oder 0), bieten wir Auf/Zu/Stopp trotzdem an —
 * sonst wäre die Kachel bei simplen Integrationen komplett tot. Eine Position
 * wird nicht geraten: ohne gemeldete Unterstützung fehlt auch `current_position`,
 * der Slider hätte also keinen Wert zum Anzeigen.
 */
export function coverFeatures(attrs: Record<string, unknown>): CoverFeatures {
  const f = typeof attrs.supported_features === "number" ? attrs.supported_features : 0;
  const unknown = f === 0;
  return {
    open: unknown || (f & FEATURE_OPEN) !== 0,
    close: unknown || (f & FEATURE_CLOSE) !== 0,
    stop: unknown || (f & FEATURE_STOP) !== 0,
    setPosition: (f & FEATURE_SET_POSITION) !== 0,
  };
}

/** Position in Prozent (100 = ganz offen) oder null, wenn HA keine liefert. */
export function coverPosition(attrs: Record<string, unknown>): number | null {
  const p = attrs.current_position;
  if (typeof p !== "number" || isNaN(p)) return null;
  return Math.max(0, Math.min(100, Math.round(p)));
}

/** Fährt der Rollladen gerade? */
export function coverMoving(state: string | undefined): boolean {
  return state === "opening" || state === "closing";
}

/** „Offen" = Position > 0, ersatzweise der HA-Zustand. */
export function coverIsOpen(state: string | undefined, position: number | null): boolean {
  if (position !== null) return position > 0;
  return state === "open" || state === "opening";
}

/** Zustandstext der Kachel: „Offen · 60%", „Schließt… · 40%", „Geschlossen". */
export function coverStateLabel(state: string | undefined, position: number | null): string {
  if (!state || state === "unavailable" || state === "unknown") return "nicht verfügbar";
  const suffix = position === null ? "" : ` · ${position}%`;
  if (state === "opening") return `Öffnet…${suffix}`;
  if (state === "closing") return `Schließt…${suffix}`;
  if (!coverIsOpen(state, position)) return "Geschlossen";
  return position !== null && position < 100 ? `Offen · ${position}%` : "Offen";
}

/** Tap auf die Kachel: fahrend → stoppen (falls unterstützt), sonst umschalten. */
export function coverTapService(
  state: string | undefined,
  position: number | null,
  features: CoverFeatures,
): CoverService {
  if (coverMoving(state) && features.stop) return "stop_cover";
  return coverIsOpen(state, position) ? "close_cover" : "open_cover";
}

/** Verb für den Aktions-Log der Kachel. */
export function coverActionVerb(service: CoverService): string {
  if (service === "stop_cover") return "gestoppt";
  return service === "open_cover" ? "geöffnet" : "geschlossen";
}
