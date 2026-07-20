/**
 * Reine Ableitungs-Logik fürs neue Design: Geräte werden nicht mehr frei im
 * Raster platziert, sondern automatisch nach Kategorie gruppiert (Domain →
 * Kategorie, wie im Design). Custom-Kategorien kommen aus Dashboard.meta.
 *
 * Bewusst frei von React/DOM → unit-testbar (siehe board.test.ts).
 */
import type { CustomCategory, Dashboard, DashboardMeta, WidgetConfig } from "./dashboards";

/** Warm-/Kalt-Akzent des Designs (auch als CSS-Variablen in global.css gespiegelt). */
export const ACCENT_WARM = "#ef936b";
export const ACCENT_COOL = "#6ea8fe";

export interface CategoryDef {
  key: string;
  name: string;
  icon: string; // Icon-Schlüssel aus controls/icons.ts
  custom?: boolean;
}

/** Basis-Kategorien in Anzeige-Reihenfolge. */
export const BASE_CATEGORIES: CategoryDef[] = [
  { key: "licht", name: "Beleuchtung", icon: "light" },
  { key: "geraete", name: "Steckdosen & Geräte", icon: "plug" },
  { key: "luft", name: "Ventilation", icon: "fan" },
  { key: "rollo", name: "Rollläden", icon: "blinds" },
  { key: "medien", name: "Medien", icon: "speaker" },
  { key: "sensor", name: "Sensoren", icon: "motion" },
];

const BASE_KEYS = new Set(BASE_CATEGORIES.map((c) => c.key));

/** Entity-Domain → Basiskategorie-Schlüssel. */
export function categoryForDomain(domain: string): string {
  switch (domain) {
    case "light":
      return "licht";
    case "fan":
      return "luft";
    case "cover":
      return "rollo";
    case "media_player":
      return "medien";
    case "sensor":
    case "binary_sensor":
    case "weather":
      return "sensor";
    case "switch":
    case "input_boolean":
    default:
      return "geraete";
  }
}

/** Domain eines Widgets (leer bei entity-losen Widgets). */
export function domainOf(widget: WidgetConfig): string {
  return widget.entity_id ? widget.entity_id.split(".")[0] : "";
}

/**
 * Kategorie eines Widgets: expliziter Override (options.category) vor
 * Domain-Ableitung. Zeigt der Override auf eine nicht (mehr) existierende
 * Kategorie, fällt er auf die Domain-Kategorie zurück.
 */
export function categoryOf(widget: WidgetConfig, known?: Set<string>): string {
  const override = widget.options?.category;
  if (typeof override === "string" && override) {
    if (!known || known.has(override)) return override;
  }
  return categoryForDomain(domainOf(widget));
}

/** Uhr/Kalender sind Teil der Shell (Header/Agenda), nicht Kacheln. */
export function isTileWidget(widget: WidgetConfig): boolean {
  return widget.type !== "clock" && widget.type !== "calendar";
}

/**
 * „Ist an/aktiv" für Zähler und die Aktiv-Ansicht (schaltbare Geräte).
 * Sensoren zählen nie; Medien nur bei laufender Wiedergabe.
 */
export function isOn(domain: string, state: string | undefined): boolean {
  if (!state) return false;
  switch (domain) {
    case "cover":
      return state === "open" || state === "opening";
    case "media_player":
      return state === "playing";
    case "sensor":
    case "binary_sensor":
    case "weather":
      return false;
    default:
      return state === "on";
  }
}

/** Zählt in der Aktiv-Ansicht/Übersicht mitzählende (schaltbare) Geräte. */
export function isControllable(domain: string): boolean {
  return domain !== "sensor" && domain !== "binary_sensor" && domain !== "weather";
}

/** Alle Kachel-Widgets eines Dashboards (über alle Gruppen flach). */
export function allWidgets(dashboard: Dashboard | null): WidgetConfig[] {
  if (!dashboard) return [];
  const out: WidgetConfig[] = [];
  for (const g of dashboard.groups) {
    for (const w of g.widgets) if (isTileWidget(w)) out.push(w);
  }
  return out;
}

/** Custom-Kategorien aus meta (defensiv gegen kaputte Daten). */
export function customCategories(meta: DashboardMeta | undefined): CustomCategory[] {
  const list = meta?.customCategories;
  if (!Array.isArray(list)) return [];
  return list.filter(
    (c): c is CustomCategory =>
      !!c && typeof c.key === "string" && typeof c.name === "string" && typeof c.icon === "string",
  );
}

/** Basis- + Custom-Kategorien (Custom hinten, in Definitionsreihenfolge). */
export function allCategories(meta: DashboardMeta | undefined): CategoryDef[] {
  const custom = customCategories(meta)
    .filter((c) => !BASE_KEYS.has(c.key))
    .map((c) => ({ key: c.key, name: c.name, icon: c.icon, custom: true }));
  return BASE_CATEGORIES.concat(custom);
}

export interface CategoryBucket {
  def: CategoryDef;
  widgets: WidgetConfig[];
}

/**
 * Widgets nach Kategorie bündeln, in Kategorie-Reihenfolge. Im Normalbetrieb
 * werden leere Kategorien weggelassen; im Edit-Modus alle gezeigt (zum Befüllen).
 */
export function bucketByCategory(
  widgets: WidgetConfig[],
  cats: CategoryDef[],
  includeEmpty: boolean,
): CategoryBucket[] {
  const known = new Set(cats.map((c) => c.key));
  const byKey = new Map<string, WidgetConfig[]>();
  for (const c of cats) byKey.set(c.key, []);
  for (const w of widgets) {
    const key = categoryOf(w, known);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(w);
    else byKey.get("geraete")?.push(w); // Fallback, sollte nie greifen
  }
  const out: CategoryBucket[] = [];
  for (const def of cats) {
    const ws = byKey.get(def.key) ?? [];
    if (ws.length > 0 || includeEmpty) out.push({ def, widgets: ws });
  }
  return out;
}

/** Tageszeit-Gruß (ohne Namen — der ist nicht Teil der Produktdaten). */
export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "Gute Nacht";
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Schönen Tag";
  if (h < 22) return "Guten Abend";
  return "Gute Nacht";
}

/**
 * Fügt einer #hex- / hsl() / rgb()-Farbe einen Alpha-Wert hinzu → rgba()/hsla().
 * (Für die Akzent-Verläufe der aktiven Kacheln.)
 */
export function withAlpha(color: string, alpha: number): string {
  if (color.charAt(0) === "#") {
    let n = color.slice(1);
    if (n.length === 3)
      n = n
        .split("")
        .map((c) => c + c)
        .join("");
    const r = parseInt(n.slice(0, 2), 16);
    const g = parseInt(n.slice(2, 4), 16);
    const b = parseInt(n.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (color.indexOf("hsl(") === 0) return color.replace("hsl(", "hsla(").replace(")", `,${alpha})`);
  if (color.indexOf("rgb(") === 0) return color.replace("rgb(", "rgba(").replace(")", `,${alpha})`);
  return color;
}
