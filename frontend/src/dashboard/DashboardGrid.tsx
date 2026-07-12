import type { Dashboard, WidgetConfig } from "../state/dashboards";
import { LightCard } from "../widgets/LightCard";
import { SensorCard } from "../widgets/SensorCard";
import { SwitchCard } from "../widgets/SwitchCard";
import { Tile } from "../widgets/Tile";
import { GaugeIcon } from "../controls/icons";
import "./DashboardGrid.css";

function Widget({ config }: { config: WidgetConfig }) {
  switch (config.type) {
    case "light":
      return <LightCard config={config} />;
    case "switch":
      return <SwitchCard config={config} />;
    case "sensor":
      return <SensorCard config={config} />;
    default:
      return (
        <Tile
          icon={GaugeIcon}
          title={config.title ?? config.entity_id}
          subtitle={`Unbekannter Typ: ${config.type}`}
          unavailable
        />
      );
  }
}

export function DashboardGrid({ dashboard }: { dashboard: Dashboard }) {
  if (dashboard.widgets.length === 0) {
    return (
      <div className="dashboard-empty">
        <p>Noch keine Widgets in „{dashboard.name}".</p>
        <p className="dashboard-empty__hint">Der Editor zum Hinzufügen kommt in Phase 2.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      {dashboard.widgets.map((w) => (
        <Widget key={w.id} config={w} />
      ))}
    </div>
  );
}
