/**
 * Lage column (04 §5.4): quiet rows, deviations become blocks at the top.
 * Pure function (cfg, states, now) -> { blocks, rows }, tested in lage.test.ts.
 */
import { lightsSummary } from "./counts";
import { duration, hhmm, minutesSince, parseNum, pct, temp } from "./format";
import { APPLIANCE_ABORTED, APPLIANCE_DONE, APPLIANCE_RUNNING } from "./tileState";
import type { Board, EntityState, LageCfg, StateGetter } from "./model";

export type Tone = "red" | "amber" | "warm";

export type LageTap = { t: "contacts" } | { t: "active" } | { t: "vacuum" } | { t: "item"; id: string } | null;

export interface LageBlock {
  key: string;
  tone: Tone;
  icon: string;
  head: string;
  big: string;
  small?: string;
  sub: string;
  progress?: number | null;
  tap: LageTap;
}

export interface LageRow {
  key: string;
  icon: string;
  name: string;
  value: string;
  /** Muted tail of the value ("· 1 offline"). */
  muted?: string;
  tone?: "on" | Tone;
  chev?: boolean;
  tap: LageTap;
}

export interface Lage {
  blocks: LageBlock[];
  rows: LageRow[];
}

/** Fixed heights (04 §5.4). */
export const LAGE_HEIGHT = 630;
export const BLOCK_H = 116;
export const BLOCK_PROGRESS_H = 128;
export const BLOCK_GAP = 8;
export const BLOCKS_TO_ROWS = 4; // + the 8 px gap below the last block = 12
export const ROW_H = 48;
export const MAX_BLOCKS = 3;

const TONE_RANK: Record<Tone, number> = { red: 0, amber: 1, warm: 2 };

interface Contact {
  id: string;
  name: string;
  zone: string;
  alarm_after_s: number;
}

interface Entry {
  key: string;
  block?: LageBlock;
  row: LageRow;
}

function zoneName(board: Board, id: string): string {
  const z = board.zones.filter((x) => x.id === id)[0];
  return z ? z.name : "";
}

/** "Kühlschrank offen" for short names, else the device class word. */
function shortOpen(c: Contact, st: EntityState | undefined): string {
  if (c.name.length <= 12) return `${c.name} offen`;
  return st?.attributes.device_class === "window" ? "Fenster offen" : "Tür offen";
}

function openings(cfg: LageCfg, board: Board, get: StateGetter, now: number): Entry {
  const contacts = (cfg.contacts as Contact[]) || [];
  const open = contacts.filter((c) => get(c.id)?.state === "on");
  const since = (c: Contact) => {
    const st = get(c.id);
    return st && typeof st.lc_ts === "number" ? st.lc_ts : now;
  };
  const alarms = open.filter((c) => now - since(c) >= (c.alarm_after_s || 0) * 1000);
  const row: LageRow = { key: cfg.key, icon: cfg.icon, name: cfg.name, value: "alles zu", tap: { t: "contacts" } };
  if (open.length === 1) row.value = shortOpen(open[0], get(open[0].id));
  else if (open.length > 1) row.value = `${open.length} offen`;
  if (!alarms.length) return { key: cfg.key, row };
  let block: LageBlock;
  if (alarms.length === 1) {
    const c = alarms[0];
    const st = get(c.id);
    const t0 = since(c);
    const vent = parseNum(cfg.vent_minutes ? get(cfg.vent_minutes as string)?.state : undefined);
    const isWindow = st?.attributes.device_class === "window";
    const where = isWindow && vent !== null ? `${Math.round(vent)} min empfohlen` : zoneName(board, c.zone);
    block = {
      key: cfg.key, tone: "red", icon: isWindow ? "window" : c.zone === "kueche" ? "fridge" : "door",
      head: c.name, big: "Offen", small: duration(minutesSince(t0, now)),
      sub: where ? `seit ${hhmm(t0)}, ${where}` : `seit ${hhmm(t0)}`, tap: { t: "contacts" },
    };
  } else {
    block = {
      key: cfg.key, tone: "red", icon: cfg.icon, head: cfg.name, big: `${alarms.length} offen`,
      sub: alarms.map((c) => c.name).join(", "), tap: { t: "contacts" },
    };
  }
  return { key: cfg.key, row, block };
}

interface ApplianceRefs {
  state?: string;
  remaining?: string;
  progress?: string;
  phase?: string;
  program?: string;
}

function appliance(cfg: LageCfg, board: Board, get: StateGetter, now: number): Entry {
  const virt = cfg.virtual ? board.items[cfg.virtual as string] : undefined;
  const refs: ApplianceRefs = (virt as ApplianceRefs) || (cfg as unknown as ApplianceRefs);
  const tap: LageTap = virt ? { t: "item", id: virt.id } : null;
  const row: LageRow = { key: cfg.key, icon: cfg.icon, name: cfg.name, value: "aus", tap };
  const st = refs.state ? get(refs.state) : undefined;
  if (!st || st.state === "unavailable") {
    row.value = "offline";
    return { key: cfg.key, row };
  }
  const s = st.state;
  if (APPLIANCE_RUNNING.indexOf(s) !== -1) {
    const rem = parseNum(refs.remaining ? get(refs.remaining)?.state : undefined);
    const prog = parseNum(refs.progress ? get(refs.progress)?.state : undefined);
    const phaseRaw = refs.phase ? get(refs.phase)?.state : undefined;
    const phase = phaseRaw && phaseRaw !== "unknown" && phaseRaw !== "unavailable" ? phaseRaw : "Läuft";
    const paused = s === "paused" || s === "user_paused";
    const block: LageBlock = {
      key: cfg.key, tone: "warm", icon: cfg.icon, head: cfg.name,
      big: paused ? "Pausiert" : rem !== null && rem > 0 ? `noch ${Math.round(rem)}` : phase,
      small: !paused && rem !== null && rem > 0 ? "min" : undefined,
      sub: rem !== null && rem > 0 ? `${phase}, fertig ca. ${hhmm(now + rem * 60000)}` : phase,
      progress: prog, tap,
    };
    row.value = paused ? "pausiert" : rem !== null && rem > 0 ? `noch ${duration(rem)}` : "läuft";
    return { key: cfg.key, row, block };
  }
  if (APPLIANCE_DONE.indexOf(s) !== -1 || APPLIANCE_ABORTED.indexOf(s) !== -1) {
    const done = APPLIANCE_DONE.indexOf(s) !== -1;
    const t0 = typeof st.lc_ts === "number" ? st.lc_ts : now;
    row.value = done ? "fertig" : "abgebrochen";
    return {
      key: cfg.key, row,
      block: {
        key: cfg.key, tone: "amber", icon: cfg.icon, head: cfg.name, big: done ? "Fertig" : "Abgebrochen",
        sub: done ? `seit ${hhmm(t0)}, ausräumen` : `seit ${hhmm(t0)}`, tap,
      },
    };
  }
  return { key: cfg.key, row };
}

const VACUUM_ROW: Record<string, string> = {
  docked: "in der Station",
  charging: "in der Station",
  idle: "bereit",
  paused: "pausiert",
  returning: "fährt zurück",
  cleaning: "saugt",
  error: "Fehler",
};

function vacuum(cfg: LageCfg, get: StateGetter): Entry {
  const st = cfg.vacuum ? get(cfg.vacuum as string) : undefined;
  const tap: LageTap = { t: "vacuum" };
  const row: LageRow = { key: cfg.key, icon: cfg.icon, name: cfg.name, value: "offline", tap };
  if (!st || st.state === "unavailable") return { key: cfg.key, row };
  row.value = VACUUM_ROW[st.state] || st.state;
  const err = cfg.error ? get(cfg.error as string)?.state : undefined;
  if (err && err !== "no_error" && err !== "unknown" && err !== "unavailable") {
    return { key: cfg.key, row, block: { key: cfg.key, tone: "amber", icon: cfg.icon, head: cfg.name, big: "Fehler", sub: err.replace(/_/g, " "), tap } };
  }
  if (st.state === "cleaning" || st.state === "returning") {
    const room = cfg.room ? get(cfg.room as string)?.state : undefined;
    const prog = parseNum(st.attributes.cleaning_progress);
    return {
      key: cfg.key, row,
      block: {
        key: cfg.key, tone: "warm", icon: cfg.icon, head: cfg.name,
        big: st.state === "returning" ? "Rückfahrt" : room && room !== "unknown" ? room : "Saugt",
        sub: st.state === "returning" ? "fährt zur Station" : "saugt", progress: prog, tap,
      },
    };
  }
  return { key: cfg.key, row };
}

function innen(cfg: LageCfg, board: Board, get: StateGetter): Entry {
  const t = parseNum(cfg.temp ? get(cfg.temp as string)?.state : undefined);
  const h = parseNum(cfg.hum ? get(cfg.hum as string)?.state : undefined);
  const parts: string[] = [];
  if (t !== null) parts.push(temp(t));
  if (h !== null) parts.push(pct(h));
  const climate = board.heating.rooms?.wohnbereich?.climate;
  return {
    key: cfg.key,
    row: { key: cfg.key, icon: cfg.icon, name: cfg.name, value: parts.length ? parts.join("  ") : "–", tap: climate && board.items[climate] ? { t: "item", id: climate } : null },
  };
}

function musik(cfg: LageCfg, board: Board, get: StateGetter): Entry {
  const mr = cfg.multiroom ? get(cfg.multiroom as string) : undefined;
  const id = cfg.multiroom as string | undefined;
  const row: LageRow = { key: cfg.key, icon: cfg.icon, name: cfg.name, value: "aus", tap: id && board.items[id] ? { t: "item", id } : null };
  if (mr && mr.state === "on") {
    const names = (board.music.rooms || [])
      .filter((r) => {
        const rs = get(r.id);
        return rs && rs.state !== "unavailable" && rs.attributes.is_volume_muted !== true;
      })
      .map((r) => r.name);
    row.value = names.length ? names.join(", ") : "an";
    row.tone = "on";
  }
  return { key: cfg.key, row };
}

function lichter(cfg: LageCfg, board: Board, get: StateGetter): Entry {
  const s = lightsSummary(board, get);
  return {
    key: cfg.key,
    row: {
      key: cfg.key, icon: cfg.icon, name: cfg.name, value: `${s.on} an`,
      muted: s.offline ? ` · ${s.offline} offline` : undefined, chev: true, tap: { t: "active" },
    },
  };
}

function einkauf(cfg: LageCfg, get: StateGetter): Entry {
  const n = parseNum(cfg.todo ? get(cfg.todo as string)?.state : undefined);
  return {
    key: cfg.key,
    row: { key: cfg.key, icon: cfg.icon, name: cfg.name, value: n === null ? "–" : n > 0 ? `${Math.round(n)} offen` : "leer", tap: null },
  };
}

function entry(cfg: LageCfg, board: Board, get: StateGetter, now: number): Entry | null {
  switch (cfg.key) {
    case "oeffnungen": return openings(cfg, board, get, now);
    case "waesche":
    case "spuelmaschine": return appliance(cfg, board, get, now);
    case "sauger": return vacuum(cfg, get);
    case "innen": return innen(cfg, board, get);
    case "musik": return musik(cfg, board, get);
    case "lichter": return lichter(cfg, board, get);
    case "einkauf": return einkauf(cfg, get);
  }
  return null;
}

/** Height of a Lage layout in px (fixed heights, 04 §5.4). */
export function lageHeight(blocks: LageBlock[], rows: number): number {
  let h = 0;
  for (const b of blocks) h += (b.progress !== undefined && b.progress !== null ? BLOCK_PROGRESS_H : BLOCK_H) + BLOCK_GAP;
  return h + BLOCKS_TO_ROWS + rows * ROW_H;
}

export function buildLage(board: Board, get: StateGetter, now: number): Lage {
  const entries: Entry[] = [];
  for (const cfg of board.start.lage) {
    const e = entry(cfg, board, get, now);
    if (e) entries.push(e);
  }
  // Blocks: red > amber > warm (stable within a tone), at most 3.
  const withBlock = entries.filter((e) => e.block);
  withBlock.sort((a, b) => TONE_RANK[a.block!.tone] - TONE_RANK[b.block!.tone] || entries.indexOf(a) - entries.indexOf(b));
  const shown = withBlock.slice(0, MAX_BLOCKS);
  const blocks = shown.map((e) => e.block!);
  const shownKeys = shown.map((e) => e.key);
  // A 4th block appears as a row with coloured value; a row that is a block is gone.
  let rows: LageRow[] = entries
    .filter((e) => shownKeys.indexOf(e.key) === -1)
    .map((e) => {
      if (!e.block) return e.row;
      const b = e.block;
      return { ...e.row, value: b.small ? `${b.big} ${b.small}` : b.big, muted: undefined, tone: b.tone === "warm" ? "on" : b.tone };
    });
  // Trim quiet rows until everything fits into the column.
  const trim = board.start.lage_trim_order || [];
  for (const key of trim) {
    if (lageHeight(blocks, rows.length) <= LAGE_HEIGHT) break;
    rows = rows.filter((r) => r.key !== key || r.tone);
  }
  return { blocks, rows };
}
