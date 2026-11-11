import { useRef } from "react";
import { Icon } from "../controls/icons";
import { useTap } from "../controls/useTap";
import { runOff, runOn, toggleItem } from "../state/commands";
import { useFlash, usePend } from "../state/pending";
import { useUi } from "../state/ui";
import { useTileView } from "./useTileView";
import { pipsStyle, shownView } from "./Tile";
import type { Item, KgAmbiente, KgGroup } from "../state/model";

/** Stand-in item for a Kommen & Gehen entry, so tileView/pending work unchanged. */
export function kgItem(kg: KgAmbiente | KgGroup): Item {
  const base = {
    zone: null, func: "licht" as const, tier: "zone" as const, order: null, count: false, new: false,
  };
  if (kg.role === "ambiente") {
    // switch_group semantics: x of n from the count set (no light group entity behind it).
    return { ...base, id: "kg.ambiente", kind: "switch_group", name: kg.name, icon: "lamp", members: kg.count, cloud: true };
  }
  return { ...base, id: kg.id, kind: "group", name: kg.name, icon: "ceiling", members: kg.members, features: kg.features, cloud: !!kg.cloud };
}

/**
 * K&G group tile 72 px (03 §3): like a tile plus the member segment bar.
 * Ambiente: badge switches the Tür-Schalter set (D6) via actions on/off;
 * Wohnlicht / Licht hinten: like a light group.
 */
export function KgTile({ kg }: { kg: KgAmbiente | KgGroup }) {
  const item = kgItem(kg);
  const view = useTileView(item);
  const pend = usePend(item.id);
  const flash = useFlash(item.id);
  const openPopup = useUi((s) => s.openPopup);
  const viewRef = useRef(view);
  viewRef.current = view;
  const open = () => openPopup(kg.role === "ambiente" ? { t: "kg", role: "ambiente" } : { t: "kg", role: "group", id: kg.id });
  const toggle = () => {
    const v = viewRef.current;
    if (!v || v.offline) return;
    if (kg.role === "group") return toggleItem(item, v);
    if (v.on) runOff({ scope: "ambiente" }, item);
    else runOn(item, { scope: "ambiente" });
  };
  const ref = useTap({
    iconWidth: 64,
    pressSelector: ".badge",
    pressIconOnly: true,
    onTap: (zone) => (zone === "icon" ? toggle() : open()),
    onLongPress: open,
  });
  if (!view) return null;
  const shown = shownView(view, pend ? pend.on : null, pend ? pend.phase : null);
  const cls = ["tile"];
  if (view.offline) cls.push("is-offline");
  else if (shown.on) cls.push("is-on");
  if (pend && pend.phase === "wait") cls.push("is-pending");
  if (pend && pend.phase === "failed") cls.push("is-failed");
  if (pend && pend.phase === "noresp") cls.push("is-noresp");
  if (flash) cls.push("is-flash");
  return (
    <div ref={ref} className={cls.join(" ")} data-id={item.id}>
      <div className="badge">
        <Icon name={item.icon} />
      </div>
      <div className="tile__t">
        <div className="tile__name">{kg.name}</div>
        <div className="tile__sub">{shown.status}</div>
      </div>
      {view.members ? <i className="pips" style={pipsStyle(view.members.on, view.members.n, shown.on)} /> : null}
    </div>
  );
}
