/**
 * Reine Logik für das Warn-Overlay. Bewusst ohne React/Store, damit sie mit
 * Vitest testbar ist (wie `night.ts`). Die Anzeige leitet sich vollständig aus
 * drei HA-Helpern ab — es gibt keinen eigenen Overlay-Zustand:
 *
 *   input_boolean  → an/aus  (sichtbar ⟺ "on")
 *   input_text     → Meldungstext
 *   input_select   → Dringlichkeit
 *
 * Folge: Schaltet HA den Switch aus, verschwindet die Meldung von selbst.
 */

export type AlertLevel = "wichtig" | "warnung" | "hinweis";

export interface ResolvedAlert {
  text: string;
  level: AlertLevel;
}

/** HA-Sentinel-States, die keinen echten Meldungstext darstellen. */
const NON_TEXT = new Set(["", "unavailable", "unknown"]);

/**
 * Beliebige `input_select`-Beschriftung robust auf eine der drei Stufen
 * abbilden — tolerant gegenüber Groß/Klein, Sprache und leichten Abweichungen.
 * Unbekanntes fällt auf die mittlere Stufe „warnung", nie stillschweigend weg.
 */
export function normalizeLevel(raw: string | undefined): AlertLevel {
  const s = (raw ?? "").trim().toLowerCase();
  if (s.indexOf("wicht") !== -1 || s === "critical" || s === "alarm" || s === "rot") {
    return "wichtig";
  }
  if (s.indexOf("hinweis") !== -1 || s === "info" || s === "blau") {
    return "hinweis";
  }
  if (s.indexOf("warn") !== -1 || s === "gelb") {
    return "warnung";
  }
  return "warnung";
}

/** Nur bei „on" wird überhaupt etwas gezeigt (reine Ableitung, kein Zustand). */
export function isAlertOn(switchState: string | undefined): boolean {
  return switchState === "on";
}

/** Anzuzeigenden Text + Stufe ermitteln. Leerer/Sentinel-Text → "". */
export function resolveAlert(
  textState: string | undefined,
  levelState: string | undefined,
): ResolvedAlert {
  const trimmed = (textState ?? "").trim();
  const text = NON_TEXT.has(trimmed.toLowerCase()) ? "" : trimmed;
  return { text, level: normalizeLevel(levelState) };
}
