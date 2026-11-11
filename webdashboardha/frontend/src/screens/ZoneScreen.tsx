import { useState } from "react";
import { Icon } from "../controls/icons";
import { Press } from "../controls/Press";
import { runOff } from "../state/commands";
import { useMinute } from "../state/clock";
import { zoneLightsOn } from "../state/counts";
import { parseNum, pct, temp } from "../state/format";
import { useStore } from "../state/store";
import { tileView } from "../state/tileState";
import { Tile } from "../widgets/Tile";
import { CoverWide } from "../widgets/CoverWide";
import { GroupChip } from "../widgets/GroupChip";
import type { Board, EntityState, Item, Zone } from "../state/model";

export const OFFLINE_FOLD_MS = 60 * 60 * 1000;

/** Tile or wide cover tile for an item. */
export function ItemTile({ item, name }: { item: Item; name?: string }) {
  if (item.kind === "cover" || item.kind === "cover_pos") return <CoverWide item={item} name={name} />;
  return <Tile item={item} name={name} />;
}

interface ContactCfg {
  id: string;
  name: string;
}

function contactNames(board: Board): Record<string, string> {
  const out: Record<string, string> = {};
  for (const block of board.start.lage) {
    if (block.key !== "oeffnungen") continue;
    for (const c of (block.contacts as ContactCfg[]) || []) out[c.id] = c.name;
  }
  return out;
}

/** "Fenster zu", "Kühlschrank zu, Gefrierfach zu", "Fenster Bad offen". */
export function openingsText(ids: string[], get: (id: string) => EntityState | undefined, names: Record<string, string>): string {
  if (!ids.length) return "";
  const open = ids.filter((id) => get(id)?.state === "on");
  const nameOf = (id: string) => names[id] || (get(id)?.attributes.friendly_name as string) || id;
  if (open.length) {
    const shown = open.slice(0, 2).map((id) => `${nameOf(id)} offen`);
    return open.length > 2 ? `${shown.join(", ")} +${open.length - 2}` : shown.join(", ");
  }
  const windows = ids.filter((id) => get(id)?.attributes.device_class === "window").length;
  if (ids.length <= 2 && windows < ids.length) return ids.map((id) => `${nameOf(id)} zu`).join(", ");
  return windows ? "Fenster zu" : "alles zu";
}

/** Fact line under the zone title (04 §7: Raum-Ø, humidity, openings, heating). */
function factsKey(board: Board, zone: Zone, states: Record<string, EntityState>, now: number): string {
  const get = (id: string) => states[id];
  const f = zone.facts;
  const parts: string[] = [];
  const t = f.temp ? parseNum(get(f.temp)?.state) : null;
  const h = f.hum ? parseNum(get(f.hum)?.state) : null;
  parts.push(t !== null ? temp(t) : "");
  parts.push(h !== null ? pct(h) : "");
  parts.push(f.openings ? openingsText(f.openings, get, contactNames(board)) : "");
  const climate = f.climate ? board.items[f.climate] : undefined;
  if (climate) {
    const v = tileView(climate, { get, now, heating: board.heating, music: board.music });
    parts.push(v.offline ? "Heizung offline" : `Heizung ${v.status}`);
  } else parts.push("");
  return parts.join("\u0001");
}

function ZoneFacts({ zone }: { zone: Zone }) {
  const now = useMinute();
  const key = useStore((s) => (s.board ? factsKey(s.board, zone, s.states, now) : ""));
  const [t, h, open, heat] = key.split("\u0001");
  const gap = "    ";
  return (
    <div className="zone__facts">
      {t ? <b>{t}</b> : null}
      {h ? `${t ? "  " : ""}${h}` : null}
      {open ? `${t || h ? gap : ""}${open}` : null}
      {heat ? `${t || h || open ? gap : ""}${heat}` : null}
    </div>
  );
}

/** Tiles offline for >= 60 min move into the folded "N offline" row (04 §5.3). */
export function foldedIds(board: Board, ids: string[], states: Record<string, EntityState>, now: number): string[] {
  const out: string[] = [];
  const get = (id: string) => states[id];
  for (const id of ids) {
    const item = board.items[id];
    if (!item) continue;
    const v = tileView(item, { get, now, heating: board.heating, music: board.music });
    if (v.offline && v.offlineSince !== null && now - v.offlineSince >= OFFLINE_FOLD_MS) out.push(id);
  }
  return out;
}

/** Tiles of a section that are on (label "1 an"). */
function sectionOn(board: Board, ids: string[], states: Record<string, EntityState>, now: number): number {
  let on = 0;
  const get = (id: string) => states[id];
  for (const id of ids) {
    const item = board.items[id];
    if (item && item.count && tileView(item, { get, now, heating: board.heating, music: board.music }).on) on += 1;
  }
  return on;
}

function SectionBlock({ board, name, ids, folded }: { board: Board; name: string; ids: string[]; folded: string[] }) {
  const now = useMinute();
  const visible = ids.filter((id) => folded.indexOf(id) === -1 && board.items[id]);
  const on = useStore((s) => sectionOn(board, visible, s.states, now));
  if (!visible.length) return null;
  return (
    <>
      <div className="label">
        {name}
        {on > 0 ? <span className="on">{`${on} an`}</span> : null}
      </div>
      <div className="grid4">
        {visible.map((id) => (
          <ItemTile key={id} item={board.items[id]} />
        ))}
      </div>
    </>
  );
}

/** Zone screen (04 §5.2, mockup 02): head with facts, chips, sections, offline row. */
export function ZoneScreen({ zone }: { zone: Zone }) {
  const board = useStore((s) => s.board) as Board;
  const lightsOn = useStore((s) => zoneLightsOn(zone, (id) => s.states[id]));
  const [showOffline, setShowOffline] = useState(false);
  const now = useMinute();
  const allIds: string[] = [];
  for (const sec of zone.sections) allIds.push(...sec.items);
  const foldKey = useStore((s) => foldedIds(board, allIds, s.states, now).join(","));
  const folded = foldKey ? foldKey.split(",") : [];

  const sections = zone.sections.map((sec) => (
    <SectionBlock key={sec.id} board={board} name={sec.name} ids={sec.items} folded={folded} />
  ));

  return (
    <section className="zone" data-zone={zone.id}>
      <div className="zone__head">
        <div className="zone__title">{zone.name}</div>
        <ZoneFacts zone={zone} />
        <Press
          className={`zone__off${lightsOn > 0 ? "" : " is-off"}`}
          disabled={lightsOn === 0}
          label={`${zone.name} Licht aus`}
          onPress={() => runOff({ scope: "zone", id: zone.id })}
        >
          <Icon name="power" />
          Licht aus
          {lightsOn > 0 ? <span>{lightsOn}</span> : null}
        </Press>
      </div>
      {zone.chips.length ? (
        <div className="chips">
          {zone.chips.map((id) => (board.items[id] ? <GroupChip key={id} item={board.items[id]} /> : null))}
        </div>
      ) : null}
      {sections}
      <OfflineFold folded={folded} open={showOffline} onToggle={() => setShowOffline(!showOffline)} board={board} />
    </section>
  );
}

function OfflineFold({ folded, open, onToggle, board }: { folded: string[]; open: boolean; onToggle: () => void; board: Board }) {
  if (!folded.length) return null;
  return (
    <>
      <Press className="offrow" onPress={onToggle} label="Offline-Geräte">
        <Icon name="alert" />
        {`${folded.length} offline`}
        <Icon name="chev" className="chev" />
      </Press>
      {open ? (
        <div className="grid4" style={{ marginTop: 8 }}>
          {folded.map((id) => (board.items[id] ? <ItemTile key={id} item={board.items[id]} /> : null))}
        </div>
      ) : null}
    </>
  );
}
