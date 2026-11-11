/**
 * Counters (04 §5.1): rail "an" pills, "Licht aus N", lights summary, alarm dots.
 * One selector per consumer returns a string key, so components re-render only
 * when a number actually changes, not on every state update.
 */
import { useStore } from "./store";
import { tileView } from "./tileState";
import type { Board, EntityState, StateGetter, Zone } from "./model";

const GROUPS = { group: 1, switch_group: 1 } as Record<string, number>;

function getter(states: Record<string, EntityState>): StateGetter {
  return (id) => states[id];
}

/** Tiles of a zone that count for the rail pill (no groups, no count:false). */
export function zoneOnCount(board: Board, zone: Zone, get: StateGetter, now: number): number {
  const ids: string[] = [];
  for (const s of zone.sections) ids.push(...s.items);
  ids.push(...zone.all_only);
  let n = 0;
  for (const id of ids) {
    const item = board.items[id];
    if (!item || !item.count || GROUPS[item.kind] || id.indexOf("virtual.") === 0) continue;
    if (tileView(item, { get, now, heating: board.heating, music: board.music }).on) n += 1;
  }
  return n;
}

/** Lights of a zone that "Licht aus" would switch off. */
export function zoneLightsOn(zone: Zone, get: StateGetter): number {
  let n = 0;
  for (const id of zone.light_targets) if (get(id)?.state === "on") n += 1;
  return n;
}

export interface LightsSummary {
  on: number;
  offline: number;
}

/** All counted lights (Lage row "Lichter"): on and offline. */
export function lightsSummary(board: Board, get: StateGetter): LightsSummary {
  let on = 0;
  let offline = 0;
  for (const id in board.items) {
    const item = board.items[id];
    if (id.indexOf("light.") !== 0 || !item.count || GROUPS[item.kind] || item.tier === "hidden") continue;
    const st = get(id)?.state;
    if (st === "on") on += 1;
    else if (st === "unavailable") offline += 1;
  }
  return { on, offline };
}

/** Zones with an opening open longer than its alarm threshold (red rail dot). */
export function alarmZones(board: Board, get: StateGetter, now: number): string[] {
  const out: string[] = [];
  for (const block of board.start.lage) {
    if (block.key !== "oeffnungen") continue;
    const contacts = (block.contacts as { id: string; zone: string; alarm_after_s: number }[]) || [];
    for (const c of contacts) {
      const st = get(c.id);
      if (!st || st.state !== "on") continue;
      const since = typeof st.lc_ts === "number" ? st.lc_ts : now;
      if (now - since >= (c.alarm_after_s || 0) * 1000 && out.indexOf(c.zone) === -1) out.push(c.zone);
    }
  }
  return out;
}

/** "wohnbereich:7|kueche:2|!kueche" (pills and alarm dots). */
export function railKey(board: Board | null, states: Record<string, EntityState>, now: number): string {
  if (!board) return "";
  const get = getter(states);
  const parts = board.zones.map((z) => `${z.id}:${zoneOnCount(board, z, get, now)}`);
  for (const z of alarmZones(board, get, now)) parts.push(`!${z}`);
  return parts.join("|");
}

export interface RailCounts {
  on: Record<string, number>;
  alarm: Record<string, boolean>;
}

export function parseRailKey(key: string): RailCounts {
  const on: Record<string, number> = {};
  const alarm: Record<string, boolean> = {};
  for (const p of key ? key.split("|") : []) {
    if (p.charAt(0) === "!") alarm[p.slice(1)] = true;
    else {
      const i = p.lastIndexOf(":");
      on[p.slice(0, i)] = Number(p.slice(i + 1));
    }
  }
  return { on, alarm };
}

export function useRailCounts(now: number): RailCounts {
  const key = useStore((s) => railKey(s.board, s.states, now));
  return parseRailKey(key);
}
