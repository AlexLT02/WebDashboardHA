/**
 * Accent colour ("on" state). One preset hex drives every on-token of ds.css;
 * the derived shades are mixed against the fixed surfaces so contrast stays
 * like the original orange. Plain RGB maths, Safari 12 safe (CSS variables).
 */
export interface AccentPreset {
  id: string;
  name: string;
  hex: string;
}

export const ACCENTS: AccentPreset[] = [
  { id: "orange", name: "Orange", hex: "#ef936b" },
  { id: "gelb", name: "Gelb", hex: "#e8c15a" },
  { id: "gruen", name: "Grün", hex: "#74cf8a" },
  { id: "tuerkis", name: "Türkis", hex: "#5cc8c2" },
  { id: "violett", name: "Violett", hex: "#b49cff" },
  { id: "rosa", name: "Rosa", hex: "#f28bb0" },
];

type Rgb = [number, number, number];

const TILE: Rgb = [0x15, 0x19, 0x22];
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

function rgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: Rgb, b: Rgb, t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function accentTokens(hex: string): Record<string, string> {
  const c = rgb(hex);
  const a = (o: number) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${o})`;
  return {
    "--on": hex,
    "--on-ink": mix(c, BLACK, 0.76),
    "--on-text": mix(c, WHITE, 0.3),
    "--on-line": a(0.34),
    "--on-soft": a(0.16),
    "--on-badge-press": mix(c, WHITE, 0.18),
    "--tile-on": mix(TILE, c, 0.1),
    "--on-press": mix(TILE, c, 0.16),
  };
}

export function accentById(id: string): AccentPreset {
  return ACCENTS.filter((p) => p.id === id)[0] || ACCENTS[0];
}

/** Writes the tokens on :root; the default preset clears them (ds.css values). */
export function applyAccent(id: string): void {
  const style = document.documentElement.style;
  const preset = accentById(id);
  const tokens = accentTokens(preset.hex);
  for (const k in tokens) {
    if (preset === ACCENTS[0]) style.removeProperty(k);
    else style.setProperty(k, tokens[k]);
  }
}
