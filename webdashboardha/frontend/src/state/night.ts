/**
 * Nachtmodus: Zeitfenster-Rechnung und Dauer-Umrechnung.
 *
 * Bewusst frei von React/DOM → unit-testbar (siehe night.test.ts).
 */

export type DurationUnit = "s" | "min" | "h";

export const DURATION_UNITS: { key: DurationUnit; label: string; seconds: number }[] = [
  { key: "s", label: "Sekunden", seconds: 1 },
  { key: "min", label: "Minuten", seconds: 60 },
  { key: "h", label: "Stunden", seconds: 3600 },
];

/** Minuten seit Mitternacht aus „HH:MM“; null bei ungültiger Eingabe. */
export function parseTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Liegt `now` im Nachtfenster [start, end)? Fenster über Mitternacht
 * (z. B. 22:00–06:30) werden unterstützt.
 *
 * Gleiche Start-/Endzeit heißt „kein Fenster“ (nicht „immer“) — sonst würde ein
 * versehentlich identisches Paar das Dashboard dauerhaft abdunkeln.
 */
export function isNight(start: string, end: string, now: Date): boolean {
  const from = parseTime(start);
  const to = parseTime(end);
  if (from === null || to === null || from === to) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return from < to
    ? minutes >= from && minutes < to
    : minutes >= from || minutes < to; // über Mitternacht
}

/** Sekunden → größte Einheit, die glatt aufgeht (für die Anzeige im Dialog). */
export function splitDuration(totalSeconds: number): { value: number; unit: DurationUnit } {
  const total = Math.max(0, Math.round(totalSeconds));
  if (total > 0 && total % 3600 === 0) return { value: total / 3600, unit: "h" };
  if (total > 0 && total % 60 === 0) return { value: total / 60, unit: "min" };
  return { value: total, unit: "s" };
}

/** Anzeigewert + Einheit → Sekunden (auf 0…24 h begrenzt). */
export function toSeconds(value: number, unit: DurationUnit): number {
  const factor = DURATION_UNITS.filter((u) => u.key === unit)[0]?.seconds ?? 1;
  if (!isFinite(value) || value <= 0) return 0;
  return Math.min(86400, Math.round(value * factor));
}
