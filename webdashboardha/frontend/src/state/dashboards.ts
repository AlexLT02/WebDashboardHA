import { apiUrl } from "./basePath";

export interface WidgetConfig {
  id: string;
  type: "light" | "sensor" | "switch" | "cover" | "clock" | "calendar" | "weather" | "media" | string;
  entity_id: string; // leer bei entity-losen Widgets (Uhr, Kalender)
  title?: string;
  // Position + Größe im Spaltenraster der Gruppe (0-basiert).
  x: number;
  y: number;
  w: number;
  h: number;
  options: Record<string, unknown>;
}

export interface Group {
  id: string;
  name: string; // leer = Gruppe ohne sichtbaren Titel
  icon?: string; // optionaler Kategorie-Icon-Schlüssel (neues Design)
  columns: number; // feste Spaltenzahl des Rasters = Breite des Blocks im Dashboard-Raster
  ungrouped?: boolean; // loser Bereich ohne Card/Titel (Widgets liegen direkt im Dashboard-Raster)
  // Position des Gruppen-Blocks im 6-spaltigen Dashboard-Raster (0-basiert).
  // Nur für echte Gruppen relevant; lose Widgets tragen ihre eigene x/y (= Dashboard-Koordinaten).
  x?: number;
  y?: number;
  widgets: WidgetConfig[];
}

/** Benutzerdefinierte Kategorie (Name + Icon), persistiert in Dashboard.meta. */
export interface CustomCategory {
  key: string;
  name: string;
  icon: string;
}

/** Persistierte Einstellungen (alle optional — alte Dashboards kennen sie nicht). */
export interface DashboardSettings {
  screensaver?: boolean;
  kiosk?: boolean;
  /** Nachtmodus: Anzeige im Zeitfenster abdunkeln. */
  night?: boolean;
  nightStart?: string; // "HH:MM"
  nightEnd?: string; // "HH:MM"
  nightDim?: number; // Deckkraft der Abdunklung, 0…0.95
  nightFadeSec?: number; // Dauer des Übergangs in Sekunden
  /** HA-Helfer für die Vollbild-Warnmeldung (entity_ids). */
  alertSwitchEntity?: string; // input_boolean: an = anzeigen
  alertTextEntity?: string; // input_text: Meldungstext
  alertLevelEntity?: string; // input_select: Dringlichkeit
}

/** App-Ebene: Custom-Kategorien + Settings. Persistiert im additiven `meta`-Feld. */
export interface DashboardMeta {
  customCategories?: CustomCategory[];
  settings?: DashboardSettings;
}

/** Sentinel-Ziel für „ohne Gruppe" (loser Bereich wird bei Bedarf erzeugt). */
export const UNGROUPED = "__ungrouped__";

export interface Dashboard {
  id: string;
  name: string;
  columns: number;
  groups: Group[];
  meta?: DashboardMeta;
}

export interface EntityInfo {
  entity_id: string;
  name: string;
  domain: string;
}

/** Payload für Create/Update (ohne id — die vergibt/kennt das Backend). */
export interface DashboardInput {
  name: string;
  columns: number;
  groups: Group[];
  meta?: DashboardMeta;
}

export async function fetchDashboards(): Promise<Dashboard[]> {
  const res = await fetch(apiUrl("/api/dashboards"));
  if (!res.ok) throw new Error(`Dashboards laden fehlgeschlagen (${res.status})`);
  return res.json();
}

export async function createDashboard(input: DashboardInput): Promise<Dashboard> {
  const res = await fetch(apiUrl("/api/dashboards"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Dashboard anlegen fehlgeschlagen (${res.status})`);
  return res.json();
}

export async function updateDashboard(id: string, input: DashboardInput): Promise<Dashboard> {
  const res = await fetch(apiUrl(`/api/dashboards/${id}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Dashboard speichern fehlgeschlagen (${res.status})`);
  return res.json();
}

export async function deleteDashboard(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/dashboards/${id}`), { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Dashboard löschen fehlgeschlagen (${res.status})`);
  }
}

/** Kiosk-Adresse fürs iPad; `host` ist null, wenn sie nicht ermittelbar ist. */
export interface HostInfo {
  host: string | null;
  port: number;
}

export async function fetchHostInfo(): Promise<HostInfo> {
  const res = await fetch(apiUrl("/api/hostinfo"));
  if (!res.ok) throw new Error(`Adresse laden fehlgeschlagen (${res.status})`);
  return res.json();
}

export async function fetchEntities(): Promise<EntityInfo[]> {
  const res = await fetch(apiUrl("/api/entities"));
  if (!res.ok) throw new Error(`Entities laden fehlgeschlagen (${res.status})`);
  return res.json();
}

/** Widget-Typ aus der Entity-Domain ableiten. */
export function widgetTypeForDomain(domain: string): string {
  if (domain === "light") return "light";
  if (domain === "switch" || domain === "input_boolean" || domain === "fan") return "switch";
  if (domain === "cover") return "cover";
  if (domain === "weather") return "weather";
  if (domain === "media_player") return "media";
  return "sensor"; // sensor, binary_sensor, ...
}

/** Entity-lose Vorschlags-Widgets (Uhr). */
export const SPECIAL_WIDGETS: { type: string; label: string }[] = [
  { type: "clock", label: "Uhr" },
];
