import type { Group, WidgetConfig } from "./dashboards";

/** Gesamtbreite des Dashboards in Rastereinheiten (auch in DashboardGrid gespiegelt). */
export const DASHBOARD_COLS = 6;
/** Der Gruppenname sitzt als <legend> auf dem <fieldset>-Rahmen und belegt KEINE
 *  eigene Rasterzeile mehr — spart eine ganze Zeile Höhe pro Gruppe. */
export const GROUP_HEADER_ROWS = 0;

/** Ein positioniertes Rechteck im Dashboard-Raster (Gruppe ODER loses Widget). */
export interface Block {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Belegte Zellen eines Rechtecks in ein Set schreiben. */
function addCells(set: Set<string>, w: Block): void {
  for (let dx = 0; dx < w.w; dx++) {
    for (let dy = 0; dy < w.h; dy++) set.add(`${w.x + dx},${w.y + dy}`);
  }
}

/** Überlappen sich zwei Rechtecke? */
function overlaps(a: Block, b: Block): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Erste freie Position (zeilenweise), an die ein w×h-Rechteck passt. */
function firstFreeRect(
  occupied: Set<string>,
  columns: number,
  w: number,
  h: number,
): { x: number; y: number } {
  const cols = Math.max(1, columns);
  for (let y = 0; ; y++) {
    for (let x = 0; x + w <= cols; x++) {
      let ok = true;
      for (let dx = 0; dx < w && ok; dx++) {
        for (let dy = 0; dy < h && ok; dy++) {
          if (occupied.has(`${x + dx},${y + dy}`)) ok = false;
        }
      }
      if (ok) return { x, y };
    }
  }
}

/**
 * Kollisionen auflösen: Das „fixe" Widget bleibt an seiner Stelle; alle Widgets,
 * die es überlappen, rutschen an die nächste freie Stelle (blockierendes Element
 * gleitet weiter). Nicht-überlappende Widgets bleiben unberührt (Lücken erlaubt).
 */
export function resolveOverlaps<T extends Block>(
  widgets: T[],
  columns: number,
  fixedId: string,
): T[] {
  const fixed = widgets.find((w) => w.id === fixedId);
  if (!fixed) return widgets;
  const others = widgets.filter((w) => w.id !== fixedId);
  const stable = others.filter((w) => !overlaps(w, fixed));
  const toRelocate = others.filter((w) => overlaps(w, fixed));

  const occupied = new Set<string>();
  addCells(occupied, fixed);
  for (const w of stable) addCells(occupied, w);

  const relocated = toRelocate.map((w) => {
    const pos = firstFreeRect(occupied, columns, Math.min(w.w, columns), w.h);
    const nw = { ...w, x: pos.x, y: pos.y };
    addCells(occupied, nw);
    return nw;
  });

  return [...stable, fixed, ...relocated];
}

/** Erste freie 1×1-Zelle im Raster einer Gruppe (zeilenweise). */
export function firstFreeCell(group: Group): { x: number; y: number } {
  const occupied = new Set<string>();
  for (const w of group.widgets) addCells(occupied, w);
  return firstFreeRect(occupied, group.columns, 1, 1);
}

/**
 * Widget auf Zelle (x,y) einer (ggf. anderen) Gruppe legen. Blockierende Widgets
 * in der Zielgruppe weichen an die nächste freie Stelle aus.
 */
export function placeWidget(
  groups: Group[],
  widgetId: string,
  toGroupId: string,
  x: number,
  y: number,
): Group[] {
  let dragged: WidgetConfig | undefined;
  for (const g of groups) {
    const w = g.widgets.find((w) => w.id === widgetId);
    if (w) dragged = w;
  }
  const toGroup = groups.find((g) => g.id === toGroupId);
  if (!dragged || !toGroup) return groups;

  const cols = Math.max(1, toGroup.columns);
  const nx = Math.max(0, Math.min(x, cols - dragged.w));
  const placed = { ...dragged, x: nx, y: Math.max(0, y) };

  return groups.map((g) => {
    // Aus allen Gruppen entfernen …
    let widgets = g.widgets.filter((w) => w.id !== widgetId);
    // … und in der Zielgruppe neu einsetzen + Kollisionen auflösen.
    if (g.id === toGroupId) {
      widgets = resolveOverlaps([...widgets, placed], cols, widgetId);
    }
    return { ...g, widgets };
  });
}

/** Widget-Größe (w,h) ändern und Kollisionen auflösen. */
export function resizeWidget(
  groups: Group[],
  groupId: string,
  widgetId: string,
  w: number,
  h: number,
): Group[] {
  return groups.map((g) => {
    if (g.id !== groupId) return g;
    const cols = Math.max(1, g.columns);
    const widgets = g.widgets.map((wi) => {
      if (wi.id !== widgetId) return wi;
      const nw = Math.max(1, Math.min(w, cols));
      const nh = Math.max(1, h);
      const nx = Math.min(wi.x, cols - nw);
      return { ...wi, w: nw, h: nh, x: Math.max(0, nx) };
    });
    return { ...g, widgets: resolveOverlaps(widgets, cols, widgetId) };
  });
}

/** Gruppe um eine Position nach vorne (-1) / hinten (+1) verschieben. */
export function moveGroup(groups: Group[], groupId: string, dir: -1 | 1): Group[] {
  const idx = groups.findIndex((g) => g.id === groupId);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= groups.length) return groups;
  const next = [...groups];
  [next[idx], next[target]] = [next[target], next[idx]];
  return next;
}

/** Anzahl belegter Rasterzeilen (für die Grid-Höhe). */
export function rowCount(group: Group): number {
  let max = 0;
  for (const w of group.widgets) max = Math.max(max, w.y + w.h);
  return Math.max(1, max);
}

/** Alle freien Zellen bis `rows` Zeilen — für sichtbare Raster-Slots im Edit-Modus. */
export function emptyCells(group: Group, rows: number): { x: number; y: number }[] {
  const cols = Math.max(1, group.columns);
  const taken = new Set<string>();
  for (const w of group.widgets) addCells(taken, w);
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!taken.has(`${x},${y}`)) cells.push({ x, y });
    }
  }
  return cells;
}

/* ===================================================================== */
/* Dashboard-Ebene: Gruppen-Blöcke UND lose Widgets teilen sich EIN      */
/* 6-spaltiges Raster mit fester Zeilenhöhe. Beides sind „Blöcke“.        */
/* ===================================================================== */

/** Breite eines Gruppen-Blocks in Dashboard-Spalten (= Spaltenzahl, gekappt). */
export function groupBlockWidth(group: Group): number {
  return Math.min(Math.max(1, group.columns), DASHBOARD_COLS);
}

/** Höhe eines Gruppen-Blocks in Rasterzeilen (Kopfzeile + Inhaltszeilen). */
export function groupBlockHeight(group: Group): number {
  return GROUP_HEADER_ROWS + rowCount(group);
}

/** Der lose Bereich (Widgets ohne Gruppe), falls vorhanden. */
export function looseGroup(groups: Group[]): Group | undefined {
  return groups.find((g) => g.ungrouped);
}

/** Echte (nicht-lose) Gruppen. */
export function realGroups(groups: Group[]): Group[] {
  return groups.filter((g) => !g.ungrouped);
}

/**
 * Alle Top-Level-Blöcke als Rechtecke: jede echte Gruppe als ein Block
 * (Breite=Spalten, Höhe=Kopf+Inhalt), jedes lose Widget als eigener Block.
 * Die id ist die Gruppen- bzw. Widget-id (dashboard-weit eindeutig).
 */
export function topLevelBlocks(groups: Group[]): Block[] {
  const blocks: Block[] = [];
  for (const g of groups) {
    if (g.ungrouped) {
      for (const w of g.widgets) blocks.push({ id: w.id, x: w.x, y: w.y, w: w.w, h: w.h });
    } else {
      blocks.push({
        id: g.id,
        x: g.x ?? 0,
        y: g.y ?? 0,
        w: groupBlockWidth(g),
        h: groupBlockHeight(g),
      });
    }
  }
  return blocks;
}

/** Aufgelöste Blockpositionen zurück in Gruppen/lose Widgets schreiben. */
function applyBlockPositions(groups: Group[], blocks: Block[]): Group[] {
  const pos = new Map(blocks.map((b) => [b.id, b]));
  return groups.map((g) => {
    if (g.ungrouped) {
      return {
        ...g,
        widgets: g.widgets.map((w) => {
          const p = pos.get(w.id);
          return p ? { ...w, x: p.x, y: p.y } : w;
        }),
      };
    }
    const p = pos.get(g.id);
    return p ? { ...g, x: p.x, y: p.y } : g;
  });
}

/**
 * Einen Top-Level-Block (Gruppe oder loses Widget) auf (x,y) legen; überlappende
 * Blöcke weichen dashboard-weit an die nächste freie Stelle aus.
 */
export function moveBlock(groups: Group[], blockId: string, x: number, y: number): Group[] {
  const blocks = topLevelBlocks(groups);
  const moving = blocks.find((b) => b.id === blockId);
  if (!moving) return groups;
  const nx = Math.max(0, Math.min(x, DASHBOARD_COLS - moving.w));
  const ny = Math.max(0, y);
  const next = blocks.map((b) => (b.id === blockId ? { ...b, x: nx, y: ny } : b));
  const resolved = resolveOverlaps(next, DASHBOARD_COLS, blockId);
  return applyBlockPositions(groups, resolved);
}

/** Erste freie Top-Level-Position für ein w×h-Rechteck (für neue lose Widgets). */
export function firstFreeBlock(groups: Group[], w: number, h: number): { x: number; y: number } {
  const occupied = new Set<string>();
  for (const b of topLevelBlocks(groups)) addCells(occupied, b);
  return firstFreeRect(occupied, DASHBOARD_COLS, Math.min(w, DASHBOARD_COLS), h);
}

/** Höhe des Dashboard-Rasters in Zeilen (unterste belegte Zeile aller Blöcke). */
export function dashboardRowCount(groups: Group[]): number {
  let max = 0;
  for (const b of topLevelBlocks(groups)) max = Math.max(max, b.y + b.h);
  return Math.max(1, max);
}

/** Freie Top-Level-Zellen bis `rows` Zeilen — Drop-Slots im Edit-Modus. */
export function topLevelEmptyCells(groups: Group[], rows: number): { x: number; y: number }[] {
  const taken = new Set<string>();
  for (const b of topLevelBlocks(groups)) addCells(taken, b);
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < DASHBOARD_COLS; x++) {
      if (!taken.has(`${x},${y}`)) cells.push({ x, y });
    }
  }
  return cells;
}

/**
 * Layout normalisieren: echten Gruppen ohne (bzw. mit überlappender) x/y-Position
 * eine kollisionsfreie Stelle geben. Für Altbestände, die noch als Blockfluss
 * gespeichert wurden. Idempotent, wenn schon alles kollisionsfrei ist.
 */
export function normalizeLayout(groups: Group[]): Group[] {
  const out = groups.map((g) => ({ ...g }));
  const occupied = new Set<string>();

  const clashes = (b: Block): boolean => {
    for (let dx = 0; dx < b.w; dx++)
      for (let dy = 0; dy < b.h; dy++)
        if (occupied.has(`${b.x + dx},${b.y + dy}`)) return true;
    return false;
  };

  // 1. Lose Widgets behalten ihre Position (Vorrang), sofern kollisionsfrei.
  const loose = looseGroup(out);
  if (loose) {
    for (const w of loose.widgets) {
      const b: Block = { id: w.id, x: w.x, y: w.y, w: w.w, h: w.h };
      if (!clashes(b)) addCells(occupied, b);
    }
  }

  // 2. Echte Gruppen: gültige, kollisionsfreie Position behalten; sonst zeilenweise neu setzen.
  for (const g of out) {
    if (g.ungrouped) continue;
    const w = groupBlockWidth(g);
    const h = groupBlockHeight(g);
    const positioned = g.x !== undefined && g.y !== undefined;
    const current: Block = { id: g.id, x: g.x ?? 0, y: g.y ?? 0, w, h };
    if (positioned && !clashes(current)) {
      addCells(occupied, current);
    } else {
      const spot = firstFreeRect(occupied, DASHBOARD_COLS, w, h);
      g.x = spot.x;
      g.y = spot.y;
      addCells(occupied, { id: g.id, ...spot, w, h });
    }
  }

  return out;
}
