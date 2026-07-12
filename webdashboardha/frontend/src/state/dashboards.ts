import { apiUrl } from "./basePath";

export interface WidgetConfig {
  id: string;
  type: "light" | "sensor" | "switch" | string;
  entity_id: string;
  title?: string;
  options: Record<string, unknown>;
}

export interface Group {
  id: string;
  name: string; // leer = Gruppe ohne sichtbaren Titel
  widgets: WidgetConfig[];
}

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
  return "sensor"; // sensor, binary_sensor, ...
}
