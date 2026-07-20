import { useStore } from "../state/store";
import { bucketByCategory, domainOf, isOn, type CategoryDef } from "../state/board";
import { turnOffAll } from "../state/commands";
import { Tile, type DetailKind } from "../widgets/Tile";
import type { WidgetConfig } from "../state/dashboards";

interface Props {
  widgets: WidgetConfig[];
  categories: CategoryDef[];
  onOpen: (widget: WidgetConfig, kind: DetailKind) => void;
  onRemoveWidget: (widgetId: string) => void;
  onAction?: (text: string, color: string) => void;
}

/** Nur aktive (eingeschaltete) Geräte, nach Kategorie gruppiert. Pro Gruppe „Alle aus". */
export function ActiveView({ widgets, categories, onOpen, onRemoveWidget, onAction }: Props) {
  const states = useStore((s) => s.states);
  const active = widgets.filter((w) => isOn(domainOf(w), states[w.entity_id]?.state));
  const buckets = bucketByCategory(active, categories, false);

  if (buckets.length === 0) {
    return <div className="dash-empty">Keine aktiven Geräte.</div>;
  }

  return (
    <div className="cats ha-scroll">
      {buckets.map(({ def, widgets: ws }) => (
        <section className="cat cat--card" key={def.key}>
          <div className="cat__head">
            <span className="cat__title">{def.name}</span>
            <span className="cat__spacer" />
            <button
              type="button"
              className="cat__off"
              onClick={() => {
                turnOffAll(ws, states);
                onAction?.(`${def.name} aus`, "#6b7280");
              }}
            >
              Alle aus
            </button>
          </div>
          <div className="cat__grid">
            {ws.map((w) => (
              <Tile
                key={w.id}
                widget={w}
                editMode={false}
                onOpen={onOpen}
                onRemove={onRemoveWidget}
                onAction={onAction}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
