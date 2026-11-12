import { Icon } from "../controls/icons";
import { Press } from "../controls/Press";
import { useTap } from "../controls/useTap";
import { fire } from "../state/commands";
import { useEntity } from "../state/store";
import { isEditing, useUi } from "../state/ui";
import { useTileView } from "./useTileView";
import { openEdit } from "./Tile";
import { shortName } from "../state/format";
import type { Item } from "../state/model";

export type CoverCmd = "open_cover" | "stop_cover" | "close_cover";

export function coverCmd(ids: string | string[], cmd: CoverCmd): void {
  // Bearbeiten mode: nothing moves (the cover tile opens its edit sheet instead).
  if (isEditing()) return;
  fire({ domain: "cover", service: cmd, entity_id: ids });
}

interface ButtonsProps {
  ids: string | string[];
  /** "opening" / "closing" highlights the running direction. */
  moving?: string;
  label?: string;
}

/** ▲ ■ ▼ inline buttons (56 x 48, K&G 56 x 56). Own gesture, not the tile's. */
export function CoverButtons({ ids, moving, label }: ButtonsProps) {
  return (
    <div className="cbtns" data-own="">
      <Press className={`cbtn${moving === "opening" ? " is-dir" : ""}`} own label={`${label || ""} auf`} onPress={() => coverCmd(ids, "open_cover")}>
        <Icon name="up" />
      </Press>
      <Press className="cbtn" own label={`${label || ""} stopp`} onPress={() => coverCmd(ids, "stop_cover")}>
        <Icon name="stop" />
      </Press>
      <Press className={`cbtn${moving === "closing" ? " is-dir" : ""}`} own label={`${label || ""} zu`} onPress={() => coverCmd(ids, "close_cover")}>
        <Icon name="down" />
      </Press>
    </div>
  );
}

/** Rollladen 2 x 1 in the zone (444 x 64): icon without badge, status, ▲ ■ ▼. */
export function CoverWide({ item, name, ctx }: { item: Item; name?: string; ctx?: "fav" | "zone" }) {
  const view = useTileView(item);
  const st = useEntity(item.id);
  const openPopup = useUi((s) => s.openPopup);
  const open = () => (isEditing() ? openEdit(item.id, ctx) : openPopup({ t: "item", id: item.id, name }));
  const ref = useTap({ onTap: open, onLongPress: open });
  if (!view) return null;
  const cls = `tile tile--cover span2${view.offline ? " is-offline" : ""}`;
  return (
    <div ref={ref} className={cls} data-id={item.id}>
      <div className={view.offline ? "badge" : "badge badge--bare"}>
        <Icon name={item.icon || "blinds"} />
      </div>
      <div className="tile__t">
        <div className="tile__name">{name || (item.name_auto ? shortName(item.name, 20) : item.name)}</div>
        <div className="tile__sub">{view.status}</div>
      </div>
      {!view.offline ? <CoverButtons ids={item.id} moving={st?.state} label={name || item.name} /> : null}
    </div>
  );
}
