import { useState } from "react";
import { Dialog } from "../Dialog";
import { DragBar } from "../../controls/DragBar";
import { Icon } from "../../controls/icons";
import { Press } from "../../controls/Press";
import { fire } from "../../state/commands";
import { hhmm, parseNum } from "../../state/format";
import { timeoutFor, withinTolerance } from "../../state/pending";
import { useBoard, useEntity } from "../../state/store";
import { useTileView } from "../../widgets/useTileView";
import { coverCmd } from "../../widgets/CoverWide";
import { footText } from "./common";
import type { Item } from "../../state/model";

/** ▲ ■ ▼ as big popup buttons (>= 112 x 64). */
export function BigCoverButtons({ ids, moving, disabled }: { ids: string | string[]; moving?: string; disabled?: boolean }) {
  const cls = (dir?: string) => `qchip qchip--big${moving && moving === dir ? " is-sel" : ""}${disabled ? " is-disabled" : ""}`;
  return (
    <div className="qchips qchips--3" style={{ marginTop: 18 }}>
      <Press className={cls("opening")} disabled={disabled} label="Auf" onPress={() => coverCmd(ids, "open_cover")}>
        <Icon name="up" />
      </Press>
      <Press className={cls()} disabled={disabled} label="Stopp" onPress={() => coverCmd(ids, "stop_cover")}>
        <Icon name="stop" />
      </Press>
      <Press className={cls("closing")} disabled={disabled} label="Zu" onPress={() => coverCmd(ids, "close_cover")}>
        <Icon name="down" />
      </Press>
    </div>
  );
}

/** Rollladen (04 §5.5): ▲ ■ ▼; estimated state said as such; position bar for cover_pos. */
export function CoverPopup({ item, name }: { item: Item; name?: string }) {
  const board = useBoard();
  const st = useEntity(item.id);
  const view = useTileView(item);
  const [local, setLocal] = useState<number | null>(null);
  if (!view) return null;
  const offline = view.offline;
  const assumed = st?.attributes.assumed_state === true;
  const pos = parseNum(st?.attributes.current_position);
  const withPos = item.kind === "cover_pos" && pos !== null;
  const last = st && typeof st.lc_ts === "number" ? hhmm(st.lc_ts) : "";
  const arrow = st && (st.state === "closed" || st.state === "closing") ? "▼" : "▲";
  const shownPos = local !== null ? Math.round(local * 100) : pos;

  return (
    <Dialog
      name={name || item.name}
      state={view.status}
      badge={{ icon: item.icon || "blinds", on: false, offline }}
      foot={footText(board, item, st)}
    >
      {assumed && !offline ? (
        <div className="popup__note">{`Zustand geschätzt, zuletzt ${arrow}${last ? " " + last : ""}`}</div>
      ) : null}
      <BigCoverButtons ids={item.id} moving={st?.state} disabled={offline} />
      {withPos ? (
        <>
          <div className="pval pval--sm">
            <span className="pval__num">
              {shownPos !== null ? shownPos : "–"}
              <small>% offen</small>
            </span>
            <span className="pval__k">Position</span>
          </div>
          <DragBar
            mode="fill"
            className="bar--pos"
            value={pos !== null ? pos / 100 : null}
            throttleMs={0}
            timeoutMs={timeoutFor(item.cloud)}
            disabled={offline}
            label={`${name || item.name} Position`}
            confirm={(t, r) => withinTolerance("position", t * 100, r !== null ? r * 100 : null)}
            onLocal={setLocal}
            onCommit={(v) => fire({ domain: "cover", service: "set_cover_position", entity_id: item.id, data: { position: Math.round(v * 100) } })}
          />
          <div className="qchips qchips--3">
            {[0, 50, 100].map((p) => (
              <Press
                key={p}
                className={`qchip${pos === p ? " is-sel" : ""}`}
                disabled={offline}
                onPress={() => fire({ domain: "cover", service: "set_cover_position", entity_id: item.id, data: { position: p } })}
              >
                {`${p} %`}
              </Press>
            ))}
          </div>
        </>
      ) : null}
    </Dialog>
  );
}
