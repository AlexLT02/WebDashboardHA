/**
 * Accent colour ("on" state), freely chosen as hue + saturation. Lightness is
 * fixed so on-text and badges keep their contrast on the dark tiles. One hex
 * drives every on-token of ds.css. Plain RGB maths, Safari 12 safe.
 */
export const DEFAULT_ACCENT = "#ef936b";
const LIGHTNESS = 0.68;

type Rgb = [number, number, number];

const TILE: Rgb = [0x15, 0x19, 0x22];
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

/** Stored value -> hex; 2.1.0 preset ids and junk fall back to the default. */
export function normalizeAccent(v: string): string {
  return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : DEFAULT_ACCENT;
}

function rgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hex2(v: number): string {
  const s = Math.round(v).toString(16);
  return s.length < 2 ? "0" + s : s;
}

/** hue 0..1, sat 0..1 -> hex at the fixed lightness. */
export function accentFromHs(h: number, s: number): string {
  const l = LIGHTNESS;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 1) + 1) % 1 * 6;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const seg: Rgb[] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]];
  const [r, g, b] = seg[Math.min(5, Math.floor(hp))];
  const m = l - c / 2;
  return "#" + hex2((r + m) * 255) + hex2((g + m) * 255) + hex2((b + m) * 255);
}

/** hex -> hue 0..1, sat 0..1 (HSL). */
export function hsFromAccent(hex: string): [number, number] {
  const [r, g, b] = rgb(normalizeAccent(hex)).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return [0, 0];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h /= 6;
  if (h < 0) h += 1;
  return [h, Math.min(1, s)];
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

/** Writes the tokens on :root; the default colour keeps the ds.css values. */
export function applyAccent(value: string): void {
  const hex = normalizeAccent(value);
  const style = document.documentElement.style;
  const tokens = accentTokens(hex);
  for (const k in tokens) {
    if (hex === DEFAULT_ACCENT) style.removeProperty(k);
    else style.setProperty(k, tokens[k]);
  }
}
