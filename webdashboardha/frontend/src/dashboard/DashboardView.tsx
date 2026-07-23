import { useStore } from "../state/store";
import {
  bucketByCategory,
  domainOf,
  isControllable,
  isOn,
  type CategoryDef,
} from "../state/board";
import { ICONS } from "../controls/icons";
import { Tile, type DetailKind } from "../widgets/Tile";
import type { WidgetConfig } from "../state/dashboards";

interface Props {
  widgets: WidgetConfig[];
  categories: CategoryDef[];
  editMode: boolean;
  onOpen: (widget: WidgetConfig, kind: DetailKind) => void;
  onRemoveWidget: (widgetId: string) => void;
  onAddDevice: (categoryKey: string) => void;
  onAddCategory: () => void;
  onRemoveCategory: (key: string) => void;
  onAction?: (text: string, color: string) => void;
}

export function DashboardView({
  widgets,
  categories,
  editMode,
  onOpen,
  onRemoveWidget,
  onAddDevice,
  onAddCategory,
  onRemoveCategory,
  onAction,
}: Props) {
  const states = useStore((s) => s.states);
  const buckets = bucketByCategory(widgets, categories, editMode);

  if (buckets.length === 0 && !editMode) {
    return (
      <div className="dash-empty">
        <p>Noch keine Geräte auf diesem Dashboard.</p>
        <p className="dash-empty__hint">
          Links über <b>Bearbeiten</b> Geräte &amp; Kategorien hinzufügen.
        </p>
      </div>
    );
  }

  return (
    <div className="cats ha-scroll">
      {buckets.map(({ def, widgets: ws }) => {
        const controllable = ws.filter((w) => isControllable(domainOf(w)));
        const onCount = controllable.filter((w) => isOn(domainOf(w), states[w.entity_id]?.state))
          .length;
        // Steuerbare Kategorie zeigt „an/gesamt", reine Sensor-Kategorie nur die Anzahl.
        const countLabel =
          controllable.length > 0 ? `${onCount}/${controllable.length} an` : `${ws.length}`;
        const CatIcon = ICONS[def.icon] ?? ICONS.light;

        return (
          <section key={def.key} className="cat">
            <div className="cat__head">
              <span className="cat__head-icon">
                <CatIcon size={15} />
              </span>
              <span className="cat__title">{def.name}</span>
              <span className="cat__count">{countLabel}</span>
              <span className="cat__spacer" />
              {editMode && def.custom && (
                <button
                  type="button"
                  className="cat__off"
                  onClick={() => onRemoveCategory(def.key)}
                >
                  Kategorie löschen
                </button>
              )}
            </div>

            <div className="cat__grid">
              {ws.map((w) => (
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
                <button
                  type="button"
                  className="cat__add"
                  onClick={() => onAddDevice(def.key)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
                  </svg>
                  Gerät
                </button>
              )}
            </div>
          </section>
        );
      })}

      {editMode && (
        <button type="button" className="cat__addcat" onClick={onAddCategory}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
          </svg>
          Kategorie hinzufügen
        </button>
      )}
    </div>
  );
}
