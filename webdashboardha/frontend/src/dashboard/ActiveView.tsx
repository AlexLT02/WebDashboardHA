import { useStore } from "../state/store";
import { domainOf, isOn } from "../state/board";
import { turnOffAll } from "../state/commands";
import { Tile, type DetailKind } from "../widgets/Tile";
import type { WidgetConfig } from "../state/dashboards";

interface Props {
  widgets: WidgetConfig[];
  onOpen: (widget: WidgetConfig, kind: DetailKind) => void;
  onRemoveWidget: (widgetId: string) => void;
  onAction?: (text: string, color: string) => void;
}

/** Nur aktive (eingeschaltete) Geräte — flache Liste, oben ein „Alle aus". */
export function ActiveView({ widgets, onOpen, onRemoveWidget, onAction }: Props) {
  const states = useStore((s) => s.states);
  const active = widgets.filter((w) => isOn(domainOf(w), states[w.entity_id]?.state));

  if (active.length === 0) {
    return <div className="dash-empty">Keine aktiven Geräte.</div>;
  }

  return (
    <div className="cats ha-scroll">
      <div className="cat__head">
        <span className="cat__spacer" />
        <button
          type="button"
          className="cat__off"
          onClick={() => {
            turnOffAll(active, states);
            onAction?.("Alle aus", "#6b7280");
          }}
        >
          Alle aus
        </button>
      </div>
      <div className="cat__grid">
        {active.map((w) => (
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
    </div>
  );
}
