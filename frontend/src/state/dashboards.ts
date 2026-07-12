import { apiUrl } from "./basePath";

export interface WidgetConfig {
  id: string;
  type: "light" | "sensor" | "switch" | string;
  entity_id: string;
  title?: string;
  options: Record<string, unknown>;
}

export interface Dashboard {
  id: string;
  name: string;
  columns: number;
  widgets: WidgetConfig[];
}

export async function fetchDashboards(): Promise<Dashboard[]> {
  const res = await fetch(apiUrl("/api/dashboards"));
  if (!res.ok) throw new Error(`Dashboards laden fehlgeschlagen (${res.status})`);
  return res.json();
}

export async function fetchDashboard(id: string): Promise<Dashboard> {
  const res = await fetch(apiUrl(`/api/dashboards/${id}`));
  if (!res.ok) throw new Error(`Dashboard ${id} laden fehlgeschlagen (${res.status})`);
  return res.json();
}
