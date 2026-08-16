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

/* ────────────────────────────────────────────────────────────────────────────
   Mehrere gleichzeitige Warnungen (Register `input_text.wdh_slot_1..N`)

   Ein Slot trägt genau einen String: "warn_id|stufe|text". Leer = frei. Die
   Reihenfolge der Slots ist die Reihenfolge der Laufschrift; welcher Eintrag
   gerade "dran" ist (und damit die Geräte steuert), sagt HA über den Index —
   das Frontend erfindet keine eigene Rotation, sonst liefen Licht und Text
   auseinander.
   ──────────────────────────────────────────────────────────────────────────── */

/** Anzahl der Register-Slots (muss zu den HA-Helfern passen). */
export const ALERT_SLOTS = 4;

export interface ActiveAlert {
  /** 1-basierte Slot-Nummer — entspricht `input_number.wdh_index`. */
  slot: number;
  /** Warn-ID (Entity-ID der auslösenden Automation). */
  id: string;
  text: string;
  level: AlertLevel;
}

const LEVEL_RANK: Record<AlertLevel, number> = { hinweis: 1, warnung: 2, wichtig: 3 };

/** Einen Slot-String parsen. Leer, Sentinel oder ohne Warn-ID → null. */
export function parseSlot(slot: number, raw: string | undefined): ActiveAlert | null {
  const value = (raw ?? "").trim();
  if (!value || NON_TEXT.has(value.toLowerCase())) return null;
  const parts = value.split("|");
  const id = (parts[0] ?? "").trim();
  if (!id) return null;
  const text = (parts.slice(2).join("|") ?? "").trim();
  return { slot, id, text, level: normalizeLevel(parts[1]) };
}

/** Alle belegten Slots, in Slot-Reihenfolge. `raws[i]` = Slot i+1. */
export function collectAlerts(raws: (string | undefined)[]): ActiveAlert[] {
  const out: ActiveAlert[] = [];
  for (let i = 0; i < raws.length; i++) {
    const parsed = parseSlot(i + 1, raws[i]);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** Höchste vorkommende Dringlichkeit (für Rahmen/Ton der Gesamtmeldung). */
export function topLevel(alerts: ActiveAlert[]): AlertLevel {
  let best: AlertLevel = "hinweis";
  for (const a of alerts) {
    if (LEVEL_RANK[a.level] > LEVEL_RANK[best]) best = a.level;
  }
  return best;
}

/**
 * Position (0-basiert) der gerade angezeigten Warnung in `alerts`.
 * `indexState` ist der Rohwert von `input_number.wdh_index` ("2.0"). Zeigt er
 * ins Leere — etwa direkt nachdem ein Slot freigeworden ist — wird auf die
 * erste aktive Warnung zurückgefallen, statt gar nichts zu zeigen.
 */
export function activeIndex(alerts: ActiveAlert[], indexState: string | undefined): number {
  if (alerts.length === 0) return -1;
  const slot = Math.round(Number(indexState));
  if (!isFinite(slot)) return 0;
  const pos = alerts.findIndex((a) => a.slot === slot);
  return pos === -1 ? 0 : pos;
}
