/**
 * "Alle", Eingangskorb and Bearbeiten (04 §5.7, §6 P5): pure helpers, tested
 * in alle.test.ts. Writing happens only locally in the add-on (D5).
 */
import { tileView } from "./tileState";
import type { ItemPatch } from "./api";
import type { Board, Item, StateGetter } from "./model";
import type { AllTab } from "./ui";

const MEDIA_KINDS: Record<string, number> = { tv: 1, media: 1, music_room: 1, multiroom: 1 };

export interface TabDef {
  tab: AllTab;
  label: string;
  match?: (item: Item) => boolean;
}

/** Filter chips in order; Offline/Neu/Ausgeblendet carry a count. */
export const LIST_TABS: TabDef[] = [
  { tab: "alle", label: "Alle", match: () => true },
  { tab: "licht", label: "Licht", match: (i) => i.func === "licht" },
  { tab: "ambiente", label: "Ambiente", match: (i) => i.func === "ambiente" },
  { tab: "medien", label: "Medien", match: (i) => !!MEDIA_KINDS[i.kind] },
  { tab: "geraete", label: "Geräte", match: (i) => i.func === "medien" && !MEDIA_KINDS[i.kind] },
  { tab: "klima", label: "Klima", match: (i) => i.func === "klima" },
];

export interface ListGroup {
  /** Zone id, null = "Ohne Zone". */
  zone: string | null;
  name: string;
  chips: string[];
  tiles: string[];
}

/** Zone tiles (sections + "nur Alle"), no chips. */
export function zoneTileIds(board: Board): string[] {
  const out: string[] = [];
  for (const z of board.zones) {
    for (const s of z.sections) out.push(...s.items);
    out.push(...z.all_only);
  }
  return out.filter((id) => board.items[id]);
}

export function inboxIds(board: Board): string[] {
  return board.inbox.map((r) => r.id).filter((id) => board.items[id]);
}

/** "57 Kacheln in 5 Zonen, 2 ohne Zone" */
export function allFacts(board: Board): string {
  return `${zoneTileIds(board).length} Kacheln in ${board.zones.length} Zonen, ${inboxIds(board).length} ohne Zone`;
}

/** Zone blocks of a list filter; "Ohne Zone" last. Hidden items never show here. */
export function listGroups(board: Board, match: (item: Item) => boolean): ListGroup[] {
  const ok = (id: string) => {
    const it = board.items[id];
    return !!it && it.tier !== "hidden" && match(it);
  };
  const out: ListGroup[] = [];
  for (const z of board.zones) {
    const tiles: string[] = [];
    for (const s of z.sections) tiles.push(...s.items.filter(ok));
    tiles.push(...z.all_only.filter(ok));
    const chips = z.chips.filter(ok);
    if (tiles.length || chips.length) out.push({ zone: z.id, name: z.name, chips, tiles });
  }
  const inbox = inboxIds(board).filter(ok);
  if (inbox.length) out.push({ zone: null, name: "Ohne Zone", chips: [], tiles: inbox });
  return out;
}

/** Every tile (zones, inbox) that is offline right now, no matter how long. */
export function offlineIds(board: Board, get: StateGetter, now: number): string[] {
  const out: string[] = [];
  for (const id of zoneTileIds(board).concat(inboxIds(board))) {
    const it = board.items[id];
    if (tileView(it, { get, now, heating: board.heating, music: board.music }).offline && out.indexOf(id) === -1) out.push(id);
  }
  return out;
}

/** "Neu eingeordnet": still marked new (7 days, not tapped), already in a zone. */
export function newlyPlaced(board: Board): string[] {
  const tiles = zoneTileIds(board);
  const chips: string[] = [];
  for (const z of board.zones) chips.push(...z.chips);
  return tiles.concat(chips).filter((id) => board.items[id] && board.items[id].new);
}

export function zoneNameOf(board: Board, zone: string | null | undefined): string {
  if (!zone) return "";
  const z = board.zones.filter((x) => x.id === zone)[0];
  return z ? z.name : "";
}

/** "PC, an" for the "Neu eingeordnet" tiles (mockup 06). */
export function withZone(zone: string, status: string): string {
  if (!zone) return status;
  return `${zone}, ${status.charAt(0).toLowerCase()}${status.slice(1)}`;
}

// ---- edit sheet --------------------------------------------------------------------

export type Stufe = "start" | "zone" | "all" | "hidden";

export const FAV_MAX = 15;

export function isFavorite(board: Board, id: string): boolean {
  return board.start.favorites.some((f) => f.id === id);
}

export function stufeOf(board: Board, item: Item): Stufe {
  if (item.tier === "hidden") return "hidden";
  if (isFavorite(board, item.id)) return "start";
  return item.tier === "all" ? "all" : "zone";
}

/** Which tiers make sense: chips cannot be "nur Alle", system items only start or not. */
export function stufeOptions(item: Item): Stufe[] {
  if (item.system) return ["start", "zone"];
  // A chip with tier "all" would still sit in its zone (board.py): no "nur Alle" for chips.
  if (item.chip) return ["start", "zone", "hidden"];
  return ["start", "zone", "all", "hidden"];
}

export interface StufeChange {
  /** New favourite order, when the favourites change. */
  favorites?: string[];
  patch?: ItemPatch;
  /** Refused, e.g. start is full. */
  error?: string;
}

/** API calls for a tier choice in the sheet (★ Start adds to the favourites, max 15). */
export function stufeChange(board: Board, item: Item, want: Stufe): StufeChange {
  const favs = board.start.favorites.map((f) => f.id);
  const isFav = favs.indexOf(item.id) !== -1;
  const out: StufeChange = {};
  if (want === "start") {
    if (!isFav) {
      if (favs.length >= FAV_MAX) return { error: `Start ist voll (${FAV_MAX})` };
      out.favorites = favs.concat([item.id]);
    }
    if (item.tier !== "zone" && !item.system) out.patch = { tier: "zone" };
    return out;
  }
  if (isFav) out.favorites = favs.filter((f) => f !== item.id);
  const tier = want === "zone" ? "zone" : want;
  if (!item.system && item.tier !== tier) out.patch = { tier };
  return out;
}

/** Ordered peers for ◀ ▶: favourites, or the item's section / "nur Alle" / chips. */
export function orderPeers(board: Board, id: string, from: "fav" | "zone"): string[] {
  if (from === "fav") return board.start.favorites.map((f) => f.id);
  for (const z of board.zones) {
    for (const s of z.sections) if (s.items.indexOf(id) !== -1) return s.items;
    if (z.all_only.indexOf(id) !== -1) return z.all_only;
    if (z.chips.indexOf(id) !== -1) return z.chips;
  }
  return [];
}

/** Favourite order with `id` moved one place. */
export function moveFavorite(ids: string[], id: string, step: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + step;
  if (i === -1 || j < 0 || j >= ids.length) return ids;
  const out = ids.slice();
  out[i] = ids[j];
  out[j] = id;
  return out;
}

/** Name field: 1 to 14 characters after trimming (backend validates the same). */
export function validName(raw: string): string | null {
  const v = raw.replace(/\s+/g, " ").trim();
  return v.length >= 1 && v.length <= 14 ? v : null;
}
