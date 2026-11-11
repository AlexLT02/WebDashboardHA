import { useRef } from "react";
import { Icon } from "../../controls/icons";
import { useTap } from "../../controls/useTap";
import { toggleItem } from "../../state/commands";
import { hhmm, watts, parseNum } from "../../state/format";
import { usePend } from "../../state/pending";
import { useBoard, useEntity } from "../../state/store";
import { useTileView } from "../../widgets/useTileView";
import { shownView } from "../../widgets/Tile";
import type { Board, EntityState, Item } from "../../state/model";

/** Zone name of an item ("Wohnbereich"), empty if it has none. */
export function zoneName(board: Board | null, item: Item | undefined): string {
  if (!board || !item || !item.zone) return "";
  const z = board.zones.filter((x) => x.id === item.zone)[0];
  return z ? z.name : "";
}

/** Popup foot: "Wohnbereich, geändert 14:18, 34 W". */
export function footText(board: Board | null, item: Item | undefined, st: EntityState | undefined, power?: EntityState): string {
  const parts: string[] = [];
  const z = zoneName(board, item);
  if (z) parts.push(z);
  if (st && typeof st.lc_ts === "number") parts.push(`geändert ${hhmm(st.lc_ts)}`);
  const w = power ? parseNum(power.state) : null;
  if (w !== null) parts.push(watts(w));
  return parts.join(", ");
}

/** Item for any entity id: from the board, or a minimal stand-in (group members). */
export function itemFor(board: Board | null, id: string, st: EntityState | undefined): Item {
  const known = board?.items[id];
  if (known) return known;
  const domain = id.split(".")[0];
  const modes = st?.attributes.supported_color_modes;
  const onoff = Array.isArray(modes) && modes.length === 1 && modes[0] === "onoff";
  return {
    id,
    kind: domain === "light" ? (onoff ? "light_onoff" : "light") : domain === "input_boolean" ? "input_boolean" : "switch",
    name: (st?.attributes.friendly_name as string) || id,
    zone: null,
    func: null,
    tier: "zone",
    order: null,
    icon: domain === "light" ? "ceiling" : "power",
    count: true,
    new: false,
    cloud: false,
  };
}

/** 48 px member row with its own icon toggle (group popup, "Was ist an?"). */
export function MemberRow({ id }: { id: string }) {
  const board = useBoard();
  const st = useEntity(id);
  const item = itemFor(board, id, st);
  const view = useTileView(item);
  const pend = usePend(id);
  const viewRef = useRef(view);
  viewRef.current = view;
  const ref = useTap({
    iconWidth: 52,
    pressSelector: ".badge",
    pressIconOnly: true,
    onTap: (zone) => {
      const v = viewRef.current;
      if (zone === "icon" && v && v.badge && !v.offline) toggleItem(item, v);
    },
  });
  if (!view) return null;
  const shown = shownView(view, pend ? pend.on : null, pend ? pend.phase : null);
  const cls = ["mrow"];
  if (view.offline) cls.push("is-offline");
  else if (shown.on) cls.push("is-on");
  return (
    <div ref={ref} className={cls.join(" ")} data-id={id}>
      <div className={view.badge || view.offline ? "badge" : "badge badge--bare"} style={pend && pend.phase === "wait" ? { opacity: 0.55 } : undefined}>
        <Icon name={item.icon} />
      </div>
      <div className="mrow__name">{item.name}</div>
      <div className="mrow__sub">{shown.status}</div>
    </div>
  );
}

/** Label/value line (info rows). */
export function InfoRow({ k, v, tone }: { k: string; v: string; tone?: "red" }) {
  return (
    <div className="mrow" style={{ paddingLeft: 8 }}>
      <div className="mrow__name" style={{ left: 8, top: 0, lineHeight: "47px", fontWeight: 400, color: "var(--text-muted)" }}>{k}</div>
      <div className={`mrow__v${tone ? " " + tone : ""}`}>{v}</div>
    </div>
  );
}
