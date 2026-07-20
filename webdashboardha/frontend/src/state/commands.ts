import { callService } from "./service";
import { domainOf, isControllable, isOn } from "./board";
import type { WidgetConfig } from "./dashboards";
import type { EntityState } from "./store";

/**
 * Alle aktiven Geräte der Liste „ausschalten" (nach Domain gebündelt = ein
 * Service-Call pro Domain). Wird nur pro Kategorie aufgerufen — daher werden
 * Cover hier bewusst geschlossen (Rollläden-Kategorie „Alle aus" = alle zu),
 * Medien pausiert.
 */
export function turnOffAll(
  widgets: WidgetConfig[],
  states: Record<string, EntityState>,
): void {
  const byDomain: Record<string, string[]> = {};
  for (const w of widgets) {
    const domain = domainOf(w);
    if (!isControllable(domain) || !w.entity_id) continue;
    if (!isOn(domain, states[w.entity_id]?.state)) continue;
    if (!byDomain[domain]) byDomain[domain] = [];
    byDomain[domain].push(w.entity_id);
  }
  for (const domain in byDomain) {
    const service =
      domain === "media_player" ? "media_pause" : domain === "cover" ? "close_cover" : "turn_off";
    callService({ domain, service, entity_id: byDomain[domain] }).catch(console.error);
  }
}
