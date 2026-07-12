import { apiUrl } from "./basePath";

export interface ServiceCallArgs {
  domain: string;
  service: string;
  entity_id?: string | string[];
  data?: Record<string, unknown>;
}

/** Ruft einen HA-Service über das Backend-Proxy auf (POST /api/service). */
export async function callService(args: ServiceCallArgs): Promise<void> {
  const res = await fetch(apiUrl("/api/service"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Service ${args.domain}.${args.service} fehlgeschlagen (${res.status}): ${detail}`);
  }
}
