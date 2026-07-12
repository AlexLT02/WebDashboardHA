import type { Group, WidgetConfig } from "./dashboards";

/** Erste freie Zelle im Raster einer Gruppe (zeilenweise). */
export function firstFreeCell(group: Group): { x: number; y: number } {
  const cols = Math.max(1, group.columns);
  const taken = new Set(group.widgets.map((w) => `${w.x},${w.y}`));
  for (let y = 0; ; y++) {
    for (let x = 0; x < cols; x++) {
      if (!taken.has(`${x},${y}`)) return { x, y };
    }
  }
}

/**
 * Widget auf Zelle (x,y) einer (ggf. anderen) Gruppe legen.
 * Ist die Zielzelle belegt, tauschen die beiden Widgets die Plätze.
 */
export function placeWidget(
  groups: Group[],
  widgetId: string,
  toGroupId: string,
  x: number,
  y: number,
): Group[] {
  let dragged: WidgetConfig | undefined;
  let fromId: string | undefined;
  for (const g of groups) {
    const w = g.widgets.find((w) => w.id === widgetId);
    if (w) {
      dragged = w;
      fromId = g.id;
    }
  }
  const toGroup = groups.find((g) => g.id === toGroupId);
  if (!dragged || !fromId || !toGroup) return groups;

  const occ = toGroup.widgets.find((w) => w.id !== widgetId && w.x === x && w.y === y);
  const oldX = dragged.x;
  const oldY = dragged.y;
  const sameGroup = fromId === toGroupId;

  return groups.map((g) => {
    let widgets = g.widgets.filter((w) => w.id !== widgetId); // dragged überall entfernen

    if (occ) {
      if (sameGroup) {
        if (g.id === toGroupId) {
          widgets = widgets.map((w) =>
            w.id === occ.id ? { ...w, x: oldX, y: oldY } : w,
          );
        }
      } else {
        if (g.id === toGroupId) widgets = widgets.filter((w) => w.id !== occ.id);
        if (g.id === fromId) widgets = [...widgets, { ...occ, x: oldX, y: oldY }];
      }
    }

    if (g.id === toGroupId) widgets = [...widgets, { ...dragged!, x, y }];
    return { ...g, widgets };
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
  for (const w of group.widgets) {
    for (let dx = 0; dx < w.w; dx++) {
      for (let dy = 0; dy < w.h; dy++) taken.add(`${w.x + dx},${w.y + dy}`);
    }
  }
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!taken.has(`${x},${y}`)) cells.push({ x, y });
    }
  }
  return cells;
}
