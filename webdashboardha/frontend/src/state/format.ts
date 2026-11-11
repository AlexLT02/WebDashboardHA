/**
 * Number, time and text formatting (04 §5.8). Pure functions, no Intl options:
 * Safari 12 is unreliable with toLocaleString options, so everything is manual.
 */

const DAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/** Numeric value of a HA state string, null for unavailable/unknown/empty. */
export function parseNum(raw: unknown): number | null {
  if (typeof raw === "number") return isFinite(raw) ? raw : null;
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const v = Number(raw);
  return isFinite(v) ? v : null;
}

/** Fixed decimals with a German decimal comma. */
export function num(v: number, digits = 0): string {
  const s = v.toFixed(digits);
  return (s === "-0" || /^-0[.,]0+$/.test(s) ? s.slice(1) : s).replace(".", ",");
}

/** "22,8°" */
export function temp(v: number | null | undefined): string {
  return v === null || v === undefined || !isFinite(v) ? "–" : `${num(v, 1)}°`;
}

/** "64 %" */
export function pct(v: number | null | undefined): string {
  return v === null || v === undefined || !isFinite(v) ? "–" : `${Math.round(v)} %`;
}

/** "34 W" */
export function watts(v: number): string {
  return `${Math.round(v)} W`;
}

/** HA brightness 0..255 to percent; an "on" light never shows 0 %. */
export function briPct(bri: number): number {
  return Math.max(1, Math.round((bri / 255) * 100));
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** "07:30" (local time). */
export function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Mittwoch" */
export function dayName(ms: number): string {
  return DAYS[new Date(ms).getDay()];
}

/** "11. November" */
export function dateLong(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}

/** Whole minutes from `fromMs` to `nowMs`, never negative. */
export function minutesSince(fromMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - fromMs) / 60000));
}

/** "42 min" / "1 h 12 min" for durations given in minutes. */
export function duration(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/**
 * Names from HA (`name_auto`) can be longer than the 14 characters a tile has
 * room for. Cut at a word boundary and mark it, instead of letting CSS clip
 * mid-word ("Kleiderschrank Ambiente" -> "Kleiderschrank…").
 */
export function shortName(name: string, max = 14): string {
  const clean = name.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const words = clean.split(" ");
  let out = "";
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > max) break;
    out = next;
  }
  if (!out) return `${clean.slice(0, max - 1)}…`;
  return out.length <= max - 1 ? `${out}…` : out;
}

const WEATHER: Record<string, string> = {
  rainy: "Regen",
  cloudy: "bewölkt",
  partlycloudy: "heiter",
  sunny: "sonnig",
  "clear-night": "klar",
  fog: "Nebel",
  snowy: "Schnee",
  "snowy-rainy": "Schneeregen",
  pouring: "Starkregen",
  lightning: "Gewitter",
  "lightning-rainy": "Gewitter",
  windy: "windig",
  "windy-variant": "windig",
  hail: "Hagel",
  exceptional: "Unwetter",
};

/** HA weather condition to the short German text of the header. */
export function weatherText(condition: string | undefined): string {
  return (condition && WEATHER[condition]) || "";
}

/** Icon name for a weather condition. */
export function weatherIcon(condition: string | undefined): string {
  if (condition === "sunny") return "sun";
  if (condition === "clear-night") return "moon";
  return "cloud";
}
