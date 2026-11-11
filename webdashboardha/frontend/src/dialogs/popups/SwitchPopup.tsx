import { useRef, useState } from "react";
import { Dialog } from "../Dialog";
import { Press } from "../../controls/Press";
import { HOLD_CRITICAL_MS } from "../../controls/useHold";
import { toggleItem } from "../../state/commands";
import { parseNum, watts } from "../../state/format";
import { usePend } from "../../state/pending";
import { useBoard, useEntity } from "../../state/store";
import { useTileView } from "../../widgets/useTileView";
import { shownView } from "../../widgets/Tile";
import { footText } from "./common";
import type { Item } from "../../state/model";

/** Schalter (04 §5.5): big switch 64 px + power. Critical sockets: off = hold 1 s. */
export function SwitchPopup({ item, name }: { item: Item; name?: string }) {
  const board = useBoard();
  const st = useEntity(item.id);
  const power = useEntity(item.power);
  const view = useTileView(item);
  const pend = usePend(item.id);
  const [hint, setHint] = useState(false);
  const hintTimer = useRef<number | undefined>(undefined);
  if (!view) return null;
  const shown = shownView(view, pend ? pend.on : null, pend ? pend.phase : null);
  const offline = view.offline;
  const w = power ? parseNum(power.state) : null;
  const toggle = () => toggleItem(item, view);
  const teach = () => {
    setHint(true);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(false), 2000);
  };
  const holdOff = view.holdOff ? { ms: HOLD_CRITICAL_MS, onFire: toggle, onShort: teach, zone: "all" as const } : null;
  const label = offline ? "Offline" : hint ? "Zum Aus 1 s halten" : shown.on ? (view.holdOff ? "An, zum Aus halten" : "An") : "Aus";

  return (
    <Dialog
      name={name || item.name}
      state={pend ? shown.status : view.status}
      stateOn={shown.on}
      badge={{
        icon: item.icon,
        on: shown.on,
        offline,
        onToggle: offline || view.holdOff ? undefined : toggle,
        holdOff: holdOff ? { ms: holdOff.ms, onFire: toggle, onShort: teach } : null,
      }}
      foot={footText(board, item, st)}
    >
      <Press
        className={`bigsw${shown.on ? " is-on" : ""}${offline ? " is-disabled" : ""}`}
        disabled={offline}
        onPress={holdOff ? undefined : toggle}
        hold={holdOff}
        label={`${name || item.name} schalten`}
      >
        {holdOff ? <div className="hold-fill" /> : null}
        {label}
      </Press>
      {w !== null ? (
        <div className="pval pval--sm">
          <span className="pval__num">
            {watts(w).replace(" W", "")}
            <small>W</small>
          </span>
          <span className="pval__k">Leistung</span>
        </div>
      ) : null}
    </Dialog>
  );
}
