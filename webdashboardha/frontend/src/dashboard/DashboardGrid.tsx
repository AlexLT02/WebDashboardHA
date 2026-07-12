import type { Dashboard, Group, WidgetConfig } from "../state/dashboards";
import { LightCard } from "../widgets/LightCard";
import { SensorCard } from "../widgets/SensorCard";
import { SwitchCard } from "../widgets/SwitchCard";
import { Tile } from "../widgets/Tile";
import { GaugeIcon } from "../controls/icons";
import { GroupHeader } from "../editor/GroupHeader";
import "./DashboardGrid.css";
import "../editor/editor.css";

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

interface Props {
  dashboard: Dashboard;
  editMode?: boolean;
  onAddWidget?: (groupId: string) => void;
  onRemoveWidget?: (groupId: string, widgetId: string) => void;
  onMoveWidget?: (groupId: string, widgetId: string, dir: -1 | 1) => void;
  onRenameGroup?: (groupId: string, name: string) => void;
  onRemoveGroup?: (groupId: string) => void;
  onAddGroup?: () => void;
}

export function DashboardGrid({
  dashboard,
  editMode,
  onAddWidget,
  onRemoveWidget,
  onMoveWidget,
  onRenameGroup,
  onRemoveGroup,
  onAddGroup,
}: Props) {
  const totalWidgets = dashboard.groups.reduce((n, g) => n + g.widgets.length, 0);

  if (totalWidgets === 0 && !editMode) {
    return (
      <div className="dashboard-empty">
        <p>Noch keine Widgets in „{dashboard.name}".</p>
        <p className="dashboard-empty__hint">Zum Bearbeiten unten auf den Stift tippen.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-groups">
      {dashboard.groups.map((group: Group) => (
        <section className="group" key={group.id}>
          <GroupHeader
            name={group.name}
            editMode={Boolean(editMode)}
            onRename={(name) => onRenameGroup?.(group.id, name)}
            onRemove={() => onRemoveGroup?.(group.id)}
            onAddWidget={() => onAddWidget?.(group.id)}
          />
          <div className="dashboard-grid">
            {group.widgets.map((w, i) => {
              if (!editMode) return <Widget key={w.id} config={w} />;
              return (
                <div className="grid-item is-editing" key={w.id}>
                  <div className="edit-overlay">
                    <button
                      type="button"
                      className="edit-overlay__btn"
                      aria-label="nach vorne"
                      disabled={i === 0}
                      onClick={() => onMoveWidget?.(group.id, w.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="edit-overlay__btn"
                      aria-label="nach hinten"
                      disabled={i === group.widgets.length - 1}
                      onClick={() => onMoveWidget?.(group.id, w.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="edit-overlay__btn edit-overlay__btn--danger"
                      aria-label="entfernen"
                      onClick={() => onRemoveWidget?.(group.id, w.id)}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid-item__widget">
                    <Widget config={w} />
                  </div>
                </div>
              );
            })}
            {editMode && group.widgets.length === 0 && (
              <button
                type="button"
                className="add-tile"
                onClick={() => onAddWidget?.(group.id)}
              >
                + Widget
              </button>
            )}
          </div>
        </section>
      ))}

      {editMode && (
        <button type="button" className="add-group" onClick={onAddGroup}>
          + Gruppe
        </button>
      )}
    </div>
  );
}
