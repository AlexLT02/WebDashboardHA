import { useRef, useState } from "react";
import { Icon } from "../controls/icons";
import { useTap } from "../controls/useTap";
import { HOLD_CRITICAL_MS } from "../controls/useHold";
import { toggleItem, domainOf } from "../state/commands";
import { pendStatus, useFlash, usePend } from "../state/pending";
import { markSeen } from "../state/api";
import { shortName } from "../state/format";
import { isEditing, useUi } from "../state/ui";
import { withZone } from "../state/alle";
import { useTileView } from "./useTileView";
import type { Item } from "../state/model";
import type { TileView } from "../state/tileState";

interface Props {
  item: Item;
  /** Name override (favorites). */
  name?: string;
  /** Kommen & Gehen size (72 px) with the member segment bar. */
  pips?: boolean;
  className?: string;
  /** Where the tile sits: favourites reorder/rename the favourite in the edit sheet. */
  ctx?: "fav" | "zone";
  /** "PC, an": zone name before the status ("Neu eingeordnet", 06). */
  zoneLabel?: string;
}

/** Bearbeiten mode: a tap on a tile, favourite or chip opens the edit sheet (04 §5.7). */
export function openEdit(id: string, ctx?: "fav" | "zone"): void {
  useUi.getState().openPopup({ t: "edit", id, from: ctx === "fav" ? "fav" : "zone" });
}

/** One background element for "x of n on" (03 §6): segments via background-size. */
export function pipsStyle(on: number, n: number, onTile: boolean): React.CSSProperties {
  const count = Math.max(1, n);
  const p = Math.round((on / count) * 1000) / 10;
  const gap = onTile ? "var(--tile-on)" : "var(--tile)";
  return {
    background:
      `linear-gradient(90deg,transparent 0,transparent 78%,${gap} 78%) 0 0/${(100 / count).toFixed(4)}% 100% repeat-x,` +
      `linear-gradient(90deg,var(--on) ${p}%,rgba(255,255,255,.15) ${p}%)`,
  };
}

/** Status shown on the tile, including optimistic and feedback phases. */
export function shownView(view: TileView, pendOn: boolean | null, phase: string | null): { on: boolean; status: string } {
  if (phase === "wait" && pendOn !== null) return { on: pendOn, status: pendStatus({ on: pendOn, phase: "wait", at: 0, until: 0 }) };
  if (phase === "failed") return { on: view.on, status: "Fehlgeschlagen" };
  if (phase === "noresp") return { on: view.on, status: "Keine Rückmeldung" };
  return { on: view.on, status: view.status };
}

/**
 * Tile 64 px (04 §5.3): icon zone (left 64 x 64) switches when there is a badge,
 * the rest opens the popup, holding 0.5 s anywhere opens it too.
 * DOM: tile, badge, svg, path, text block, name, status (+ pip / new marker).
 */
export function Tile({ item, name, pips, className, ctx, zoneLabel }: Props) {
  const view = useTileView(item);
  const pend = usePend(item.id);
  const flash = useFlash(item.id);
  const [hint, setHint] = useState(false);
  const hintTimer = useRef<number | undefined>(undefined);
  const seenSent = useRef(false);
  const openPopup = useUi((s) => s.openPopup);
  const editing = useUi((s) => s.editing);

  const viewRef = useRef(view);
  viewRef.current = view;

  const open = () => openPopup({ t: "item", id: item.id, name });
  const noteSeen = () => {
    if (item.new && !seenSent.current) {
      seenSent.current = true;
      markSeen(item.id).catch(() => undefined);
    }
  };
  const showHint = () => {
    setHint(true);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(false), 2000);
  };

  const switchable = !!view && view.badge && !view.offline && !editing;
  const ref = useTap({
    iconWidth: switchable ? 64 : 0,
    pressSelector: editing ? ":self" : ".badge",
    pressIconOnly: !editing,
    onTap: (zone) => {
      if (isEditing()) return openEdit(item.id, ctx);
      noteSeen();
      const v = viewRef.current;
      if (zone === "icon" && v && v.badge && !v.offline) toggleItem(item, v);
      else open();
    },
    onLongPress: () => {
      if (isEditing()) return openEdit(item.id, ctx);
      noteSeen();
      open();
    },
    hold:
      switchable && view && view.holdOff
        ? {
            ms: HOLD_CRITICAL_MS,
            zone: "icon",
            onFire: () => {
              const v = viewRef.current;
              if (v) toggleItem(item, v);
            },
            onShort: showHint,
          }
        : null,
  });

  if (!view) return null;
  const phase = pend ? pend.phase : null;
  const shown = shownView(view, pend ? pend.on : null, phase);
  const status = hint ? "Zum Aus 1 s halten" : zoneLabel ? withZone(zoneLabel, shown.status) : shown.status;

  const cls = ["tile"];
  if (className) cls.push(className);
  if (view.offline) cls.push("is-offline");
  else if (shown.on) cls.push("is-on");
  if (phase === "wait") cls.push("is-pending");
  if (phase === "failed") cls.push("is-failed");
  if (phase === "noresp") cls.push("is-noresp");
  if (flash) cls.push("is-flash");
  if (hint) cls.push("is-hint");
  if (item.new) cls.push("is-new");
  if (item.kind === "switch_critical") cls.push("is-critical");

  const bare = !view.badge && !view.offline;
  const icon = item.kind === "tv" || item.kind === "media" ? item.icon || "tv" : item.icon || iconFallback(item);
  const label = name || (item.name_auto ? shortName(item.name) : item.name);

  return (
    <div ref={ref} className={cls.join(" ")} data-id={item.id}>
      <div className={bare ? "badge badge--bare" : "badge"}>
        <Icon name={icon} />
      </div>
      {view.pip && shown.on && !view.offline && phase !== "wait" ? (
        <i className="pip" style={{ background: view.pip }} />
      ) : null}
      <div className="tile__t">
        <div className={label.length >= 14 ? "tile__name tile__name--long" : "tile__name"}>{label}</div>
        <div className="tile__sub">
          {view.lock && !hint && phase === null ? <Icon name="lock" size={12} /> : null}
          {status}
        </div>
      </div>
      {item.new ? <span className="new">neu</span> : null}
      {pips && view.members ? (
        <i className="pips" style={pipsStyle(view.members.on, view.members.n, shown.on)} />
      ) : null}
    </div>
  );
}

function iconFallback(item: Item): string {
  const d = domainOf(item.id);
  if (d === "light") return "ceiling";
  if (d === "cover") return "blinds";
  return "power";
}
