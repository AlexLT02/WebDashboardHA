import type { Group, WidgetConfig } from "./dashboards";

/** Belegte Zellen eines Widgets in ein Set schreiben. */
function addCells(set: Set<string>, w: WidgetConfig): void {
  for (let dx = 0; dx < w.w; dx++) {
    for (let dy = 0; dy < w.h; dy++) set.add(`${w.x + dx},${w.y + dy}`);
  }
}

/** Überlappen sich zwei Widget-Rechtecke? */
function overlaps(a: WidgetConfig, b: WidgetConfig): boolean {
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
export function resolveOverlaps(
  widgets: WidgetConfig[],
  columns: number,
  fixedId: string,
): WidgetConfig[] {
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
