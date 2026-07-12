import { useStore, type EntityState } from "../state/store";
import { callService } from "../state/service";
import { WidgetView } from "../widgets/WidgetView";
import type { Dashboard, WidgetConfig } from "../state/dashboards";
import "./DashboardGrid.css";
import "./ActiveView.css";

const ACTIVE_DOMAINS = ["light", "switch", "input_boolean", "fan", "media_player"];

function isActive(entity: EntityState | undefined): boolean {
  if (!entity) return false;
  const domain = entity.entity_id.split(".")[0];
  if (!ACTIVE_DOMAINS.includes(domain)) return false;
  return entity.state === "on" || entity.state === "playing";
}

/** Zeigt nur aktive (eingeschaltete) Geräte, gruppiert. Gruppen ohne aktive
 *  Geräte verschwinden. Pro Gruppe „Alle aus". */
export function ActiveView({ dashboard }: { dashboard: Dashboard }) {
  const states = useStore((s) => s.states);

  const groups = dashboard.groups
    .map((g) => ({
      ...g,
      widgets: g.widgets.filter((w) => isActive(states[w.entity_id])),
    }))
    .filter((g) => g.widgets.length > 0);

  if (groups.length === 0) {
    return <div className="active-empty">Keine aktiven Geräte.</div>;
  }

  const turnOffAll = (widgets: WidgetConfig[]) => {
    for (const w of widgets) {
      const domain = w.entity_id.split(".")[0];
      callService({ domain, service: "turn_off", entity_id: w.entity_id }).catch(console.error);
    }
  };

  return (
    <div className="active-view">
      {groups.map((g) => (
        <section className="active-group" key={g.id}>
          <div className="active-head">
            <span className="group__title" style={{ margin: 0, padding: 0 }}>
              {g.name || "Aktiv"}
            </span>
            <button type="button" className="active-off" onClick={() => turnOffAll(g.widgets)}>
              Alle aus
            </button>
          </div>
          <div className="active-grid">
            {g.widgets.map((w) => (
              // Einheitlich kompakt — Dashboard-Größe (w/h) hier ignorieren.
              <WidgetView key={w.id} config={{ ...w, x: 0, y: 0, w: 1, h: 1 }} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
