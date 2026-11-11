import { useState } from "react";
import { Dialog, type HeadBadge } from "../Dialog";
import { DragBar } from "../../controls/DragBar";
import { fire, toggleItem } from "../../state/commands";
import { briPct, parseNum } from "../../state/format";
import { timeoutFor, usePend, withinTolerance } from "../../state/pending";
import { useBoard, useEntity } from "../../state/store";
import { useTileView } from "../../widgets/useTileView";
import { shownView } from "../../widgets/Tile";
import { MemberRow, footText } from "./common";
import type { Item } from "../../state/model";

interface BodyProps {
  members: string[];
  /** Light group entity for the group slider (none for switch groups / Ambiente). */
  sliderEntity?: string;
  cloud?: boolean;
}

/** Group slider + member rows (> 8 in two columns). */
export function GroupBody({ members, sliderEntity, cloud }: BodyProps) {
  const gst = useEntity(sliderEntity);
  const [local, setLocal] = useState<number | null>(null);
  const on = gst?.state === "on";
  const bri = parseNum(gst?.attributes.brightness);
  const shown = local !== null ? Math.max(1, Math.round(local * 100)) : on && bri ? briPct(bri) : null;
  return (
    <>
      {sliderEntity ? (
        <>
          <div className="pval">
            <span className="pval__num">
              {shown !== null ? (
                <>
                  {shown}
                  <small>%</small>
                </>
              ) : on ? (
                "An"
              ) : (
                "Aus"
              )}
            </span>
            <span className="pval__k">Alle zusammen</span>
          </div>
          <DragBar
            mode="fill"
            value={on && bri !== null ? bri / 255 : 0}
            throttleMs={cloud ? 0 : 300}
            timeoutMs={timeoutFor(!!cloud)}
            disabled={!gst || gst.state === "unavailable"}
            label="Helligkeit der Gruppe"
            confirm={(t, r) => withinTolerance("brightness", t * 255, r !== null ? r * 255 : null)}
            onLocal={setLocal}
            onCommit={(v) =>
              v < 0.01
                ? fire({ domain: "light", service: "turn_off", entity_id: members })
                : fire({ domain: "light", service: "turn_on", entity_id: sliderEntity, data: { brightness: Math.max(1, Math.round(v * 255)) } })
            }
          />
        </>
      ) : null}
      <div className={`mrows${members.length > 8 ? " mrows--2" : ""}`}>
        {members.map((m) => (
          <MemberRow key={m} id={m} />
        ))}
      </div>
    </>
  );
}

/** Gruppe (04 §5.5) for a chip / favourite group item. */
export function GroupPopup({ item, name }: { item: Item; name?: string }) {
  const board = useBoard();
  const st = useEntity(item.kind === "group" ? item.id : undefined);
  const view = useTileView(item);
  const pend = usePend(item.id);
  if (!view) return null;
  const shown = shownView(view, pend ? pend.on : null, pend ? pend.phase : null);
  const badge: HeadBadge = {
    icon: item.icon,
    on: shown.on,
    offline: view.offline,
    onToggle: view.offline ? undefined : () => toggleItem(item, view),
  };
  return (
    <Dialog name={name || item.name} state={shown.status} stateOn={shown.on} badge={badge} foot={footText(board, item, st)}>
      <GroupBody
        members={item.members || []}
        sliderEntity={item.kind === "group" ? item.id : undefined}
        cloud={item.cloud}
      />
    </Dialog>
  );
}
