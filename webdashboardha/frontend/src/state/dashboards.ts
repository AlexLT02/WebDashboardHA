import { apiUrl } from "./basePath";

export interface WidgetConfig {
  id: string;
  type: "light" | "sensor" | "switch" | "clock" | "calendar" | "weather" | "media" | string;
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
  columns: number; // feste Spaltenzahl des Rasters
  ungrouped?: boolean; // loser Bereich ohne Card/Titel
  widgets: WidgetConfig[];
}

/** Sentinel-Ziel für „ohne Gruppe" (loser Bereich wird bei Bedarf erzeugt). */
export const UNGROUPED = "__ungrouped__";

export interface Dashboard {
  id: string;
  name: string;
  columns: number;
  groups: Group[];
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

export async function fetchEntities(): Promise<EntityInfo[]> {
  const res = await fetch(apiUrl("/api/entities"));
  if (!res.ok) throw new Error(`Entities laden fehlgeschlagen (${res.status})`);
  return res.json();
}

/** Widget-Typ aus der Entity-Domain ableiten. */
export function widgetTypeForDomain(domain: string): string {
  if (domain === "light") return "light";
  if (domain === "switch" || domain === "input_boolean" || domain === "fan") return "switch";
  if (domain === "weather") return "weather";
  if (domain === "media_player") return "media";
  return "sensor"; // sensor, binary_sensor, ...
}

/** Entity-lose Vorschlags-Widgets (Uhr, Kalender). */
export const SPECIAL_WIDGETS: { type: string; label: string }[] = [
  { type: "clock", label: "Uhr" },
  { type: "calendar", label: "Kalender" },
];
