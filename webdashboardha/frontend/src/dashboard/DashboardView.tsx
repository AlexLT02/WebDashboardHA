import { Tile, type DetailKind } from "../widgets/Tile";
import type { WidgetConfig } from "../state/dashboards";

interface Props {
  widgets: WidgetConfig[];
  editMode: boolean;
  onOpen: (widget: WidgetConfig, kind: DetailKind) => void;
  onRemoveWidget: (widgetId: string) => void;
  onAddDevice: () => void;
  onAction?: (text: string, color: string) => void;
}

/** Flache Geräteliste — keine Kategorien/Gruppierung. */
export function DashboardView({
  widgets,
  editMode,
  onOpen,
  onRemoveWidget,
  onAddDevice,
  onAction,
}: Props) {
  if (widgets.length === 0 && !editMode) {
    return (
      <div className="dash-empty">
        <p>Noch keine Geräte auf diesem Dashboard.</p>
        <p className="dash-empty__hint">
          Links über <b>Bearbeiten</b> Geräte hinzufügen.
        </p>
      </div>
    );
  }

  return (
    <div className="cats ha-scroll">
      <div className="cat__grid">
        {widgets.map((w) => (
          <Tile
            key={w.id}
            widget={w}
            editMode={editMode}
            onOpen={onOpen}
            onRemove={onRemoveWidget}
            onAction={onAction}
          />
        ))}
        {editMode && (
          <button type="button" className="cat__add" onClick={onAddDevice}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
            </svg>
            Gerät
          </button>
        )}
      </div>
    </div>
  );
}
