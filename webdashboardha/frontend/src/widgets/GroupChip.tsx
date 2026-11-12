import { useRef } from "react";
import { Icon } from "../controls/icons";
import { useTap } from "../controls/useTap";
import { toggleItem } from "../state/commands";
import { useFlash, usePend } from "../state/pending";
import { isEditing, useUi } from "../state/ui";
import { useTileView } from "./useTileView";
import { openEdit } from "./Tile";
import { shortName } from "../state/format";
import type { Item } from "../state/model";

/**
 * Group pill 44 px (03 §3): round 32 px badge switches the group, the rest
 * opens the member popup.
 */
export function GroupChip({ item }: { item: Item }) {
  const view = useTileView(item);
  const pend = usePend(item.id);
  const flash = useFlash(item.id);
  const openPopup = useUi((s) => s.openPopup);
  const viewRef = useRef(view);
  viewRef.current = view;
  const editing = useUi((s) => s.editing);
  const open = () => (isEditing() ? openEdit(item.id, "zone") : openPopup({ t: "item", id: item.id }));
  const switchable = !!view && view.badge && !view.offline && !editing;
  const ref = useTap({
    iconWidth: switchable ? 42 : 0,
    pressSelector: ".badge",
    pressIconOnly: true,
    onTap: (zone) => {
      const v = viewRef.current;
      if (zone === "icon" && v && v.badge && !v.offline && !isEditing()) toggleItem(item, v);
      else open();
    },
    onLongPress: open,
  });
  if (!view) return null;
  const on = pend && pend.phase === "wait" ? pend.on : view.on;
  const cls = ["chip"];
  if (view.offline) cls.push("is-offline");
  else if (on) cls.push("is-on");
  if (pend && pend.phase === "wait") cls.push("is-pending");
  if (flash) cls.push("is-flash");
  const m = view.members;
  return (
    <span ref={ref} className={cls.join(" ")} data-id={item.id}>
      <span className="badge">
        <Icon name={item.icon} />
      </span>
      <span className="chip__name">{item.name_auto ? shortName(item.name) : item.name}</span>
      {m ? <span className="chip__n">{`${m.on}/${m.n}`}</span> : null}
    </span>
  );
}
