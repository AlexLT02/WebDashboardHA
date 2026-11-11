import { Dialog } from "../Dialog";
import { Press } from "../../controls/Press";
import { fire } from "../../state/commands";
import { applianceView, type ApplianceRefs } from "../../state/devices";
import { now, useMinute } from "../../state/clock";
import { watts } from "../../state/format";
import { useBoard, useEntity, useStore } from "../../state/store";
import { useTileView } from "../../widgets/useTileView";
import { footText, InfoRow } from "./common";
import type { Item } from "../../state/model";

/**
 * Gerät (Wäsche, Spülmaschine; 04 §5.5): state, program, remaining time big
 * ("noch 42 min", "fertig ca. 19:20"), 6 px progress without a handle (must not
 * look like a slider), power. "Ausgeräumt" -> button.press when WashData
 * offers it (finished/clean only).
 */
export function AppliancePopup({ item, name }: { item: Item; name?: string }) {
  const board = useBoard();
  useMinute();
  const refs = item as unknown as ApplianceRefs;
  const key = useStore((s) => JSON.stringify(applianceView(refs, (id) => s.states[id], now())));
  const st = useEntity(refs.state);
  const view = useTileView(item);
  if (!view) return null;
  const v = JSON.parse(key) as ReturnType<typeof applianceView>;
  return (
    <Dialog
      name={name || item.name}
      state={view.status}
      stateOn={view.on}
      badge={{ icon: item.icon || "dishwasher", on: view.on, offline: view.offline }}
      foot={footText(board, item, st)}
    >
      <div className={`pbig${v.running ? " pbig--on" : ""}`}>
        <span className="pbig__num">
          {v.big}
          {v.small ? <small>{v.small}</small> : null}
        </span>
        {v.side ? <span className="pbig__k">{v.side}</span> : null}
      </div>
      {v.progress !== null ? (
        <div className="progress progress--6" role="progressbar" aria-valuenow={Math.round(v.progress)}>
          <i style={{ width: `${Math.max(0, Math.min(100, v.progress))}%` }} />
        </div>
      ) : null}
      <div className="mrows" style={{ marginTop: 14 }}>
        <InfoRow k="Zustand" v={v.phase || "–"} />
        <InfoRow k="Programm" v={v.program || "–"} />
        {v.power !== null ? <InfoRow k="Leistung" v={watts(v.power)} /> : null}
      </div>
      {v.unload ? (
        <Press className="bigsw" label="Ausgeräumt" onPress={() => fire({ domain: "button", service: "press", entity_id: v.unload as string })}>
          Ausgeräumt
        </Press>
      ) : null}
    </Dialog>
  );
}
