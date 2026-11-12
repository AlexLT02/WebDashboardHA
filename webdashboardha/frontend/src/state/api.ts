import { apiUrl } from "./basePath";

/** REST contract of the backend (04 §4.7). */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ApiError(`${method} ${path} (${res.status}): ${detail}`, res.status);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export interface ServiceCall {
  domain: string;
  service: string;
  entity_id?: string | string[];
  data?: Record<string, unknown>;
}

export function callService(call: ServiceCall): Promise<{ status: string }> {
  return request("POST", "/api/service", call);
}

export type OffScope =
  | { scope: "alles_aus" }
  | { scope: "zone"; id: string }
  | { scope: "group"; id: string }
  | { scope: "ambiente" }
  | { scope: "lights" };

export interface OffResult {
  undo: string | null;
  label: string;
  count: number;
  hint: string | null;
  partial: boolean;
  expires_in: number;
}

export function actionOff(scope: OffScope): Promise<OffResult> {
  return request("POST", "/api/actions/off", scope);
}

export type OnScope =
  | { scope: "ambiente" }
  | { scope: "group"; id: string; brightness_pct?: number };

export function actionOn(scope: OnScope): Promise<{ status: string; count?: number }> {
  return request("POST", "/api/actions/on", scope);
}

export function actionUndo(undo: string): Promise<{ status: string }> {
  return request("POST", "/api/actions/undo", { undo });
}

export function markSeen(id: string): Promise<{ rev: number }> {
  return request("POST", `/api/zones/items/${encodeURIComponent(id)}/seen`);
}

/** Local edit of one item (04 §4.7); `name: null` = back to the seed/HA name. */
export interface ItemPatch {
  zone?: string | null;
  name?: string | null;
  tier?: "zone" | "all" | "hidden";
  func?: "licht" | "ambiente" | "medien" | "klima";
  order_step?: -1 | 1;
}

export function patchItem(id: string, patch: ItemPatch): Promise<{ rev: number }> {
  return request("PATCH", `/api/zones/items/${encodeURIComponent(id)}`, patch);
}

export function resetItem(id: string): Promise<{ rev: number }> {
  return request("POST", `/api/zones/items/${encodeURIComponent(id)}/reset`);
}

/** Favourites in order (max 15); `names` renames single favourite tiles (P5). */
export function putFavorites(ids: string[], names?: Record<string, string>): Promise<{ rev: number }> {
  return request("PUT", "/api/zones/favorites", names ? { ids, names } : { ids });
}

export interface HostInfo {
  host: string | null;
  port: number;
}

export function fetchHostInfo(): Promise<HostInfo> {
  return request("GET", "/api/hostinfo");
}

/** Raw dashboard document; only `meta.settings` is used by 2.0 (04 §3). */
export interface DashboardDoc {
  id: string;
  name: string;
  columns: number;
  groups: unknown[];
  meta?: { settings?: Record<string, unknown>; [k: string]: unknown };
}

export function fetchDashboards(): Promise<DashboardDoc[]> {
  return request("GET", "/api/dashboards");
}

export function saveDashboard(doc: DashboardDoc): Promise<DashboardDoc> {
  // Groups/widgets/categories are passed through untouched: the 1.4.2 fallback stays intact.
  return request("PUT", `/api/dashboards/${encodeURIComponent(doc.id)}`, {
    name: doc.name,
    columns: doc.columns,
    groups: doc.groups,
    meta: doc.meta || {},
  });
}
