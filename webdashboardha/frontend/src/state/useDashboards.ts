import { useCallback, useEffect, useState } from "react";
import {
  createDashboard,
  deleteDashboard,
  fetchDashboards,
  updateDashboard,
  widgetTypeForDomain,
  UNGROUPED,
  type Dashboard,
  type EntityInfo,
  type Group,
  type WidgetConfig,
} from "./dashboards";
import {
  firstFreeBlock,
  firstFreeCell,
  moveBlock,
  normalizeLayout,
  placeWidget,
  resizeWidget as resizeWidgetFn,
} from "./grid";

/** Kollisionsarme ID ohne crypto.randomUUID (fehlt auf Safari 12). */
function genId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Zielgruppe auflösen; „ohne Gruppe" (UNGROUPED) erzeugt bei Bedarf den losen Bereich. */
function ensureTarget(groups: Group[], groupId: string): { groups: Group[]; targetId: string } {
  if (groupId !== UNGROUPED) return { groups, targetId: groupId };
  const existing = groups.find((g) => g.ungrouped);
  if (existing) return { groups, targetId: existing.id };
  const loose: Group = { id: genId("g-"), name: "", columns: 6, ungrouped: true, widgets: [] };
  return { groups: [loose, ...groups], targetId: loose.id };
}

/** Gruppen-Block an seiner aktuellen Position neu einpassen (Nachbarn weichen aus),
 *  nachdem sich seine Größe geändert hat (Spaltenzahl / neue Inhaltszeile). */
function reflowRealGroup(groups: Group[], groupId: string): Group[] {
  const g = groups.find((gr) => gr.id === groupId);
  if (!g || g.ungrouped) return groups;
  return moveBlock(groups, groupId, g.x ?? 0, g.y ?? 0);
}

/** Widget in Ziel anlegen: loses Ziel → erste freie Dashboard-Zelle, echte Gruppe →
 *  erste freie Zelle im Gruppenraster (+ Block neu einpassen, falls er wächst). */
function addWidgetToTarget(
  groups: Group[],
  groupId: string,
  makeWidget: (cell: { x: number; y: number }) => WidgetConfig,
): Group[] {
  const { groups: gs, targetId } = ensureTarget(groups, groupId);
  const target = gs.find((g) => g.id === targetId);
  if (!target) return gs;
  const cell = target.ungrouped ? firstFreeBlock(gs, 1, 1) : firstFreeCell(target);
  const widget = makeWidget(cell);
  const out = gs.map((g) => (g.id === targetId ? { ...g, widgets: [...g.widgets, widget] } : g));
  return target.ungrouped ? out : reflowRealGroup(out, targetId);
}

export interface DashboardsApi {
  dashboards: Dashboard[];
  current: Dashboard | null;
  loading: boolean;
  error: string | null;
  select: (id: string) => void;
  // Widgets
  addWidget: (entity: EntityInfo, groupId: string) => void;
  /** Entity-loses Vorschlags-Widget (Uhr, Kalender) hinzufügen. */
  addSpecialWidget: (type: string, groupId: string) => void;
  removeWidget: (groupId: string, widgetId: string) => void;
  /** Widget per Drag&Drop auf Zelle (x,y) einer (ggf. anderen) Gruppe legen. */
  placeWidgetAt: (widgetId: string, toGroupId: string, x: number, y: number) => void;
  /** Widget aus einer Gruppe lösen und frei aufs Dashboard-Raster (x,y) legen. */
  placeWidgetLoose: (widgetId: string, x: number, y: number) => void;
  /** Einen Top-Level-Block (Gruppe oder loses Widget) im Dashboard-Raster auf (x,y) legen. */
  moveBlockAt: (blockId: string, x: number, y: number) => void;
  /** Widget-Größe (Spalten/Zeilen) ändern; Nachbarn weichen aus. */
  resizeWidget: (groupId: string, widgetId: string, w: number, h: number) => void;
  /** options eines Widgets aktualisieren (Icon, Alias, …). */
  updateWidgetOptions: (widgetId: string, patch: Record<string, unknown>) => void;
  /** Ganze Gruppen-Struktur ersetzen + speichern. */
  applyGroups: (groups: Group[]) => void;
  // Gruppen
  addGroup: (name: string) => void;
  renameGroup: (groupId: string, name: string) => void;
  removeGroup: (groupId: string) => void;
  setGroupColumns: (groupId: string, columns: number) => void;
  // Dashboards
  createNew: (name: string) => Promise<void>;
  rename: (name: string) => void;
  removeCurrent: () => Promise<void>;
}

export function useDashboards(): DashboardsApi {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboards()
      .then((list) => {
        // Altbestände (Gruppen ohne x/y) einmalig aufs Dashboard-Raster normalisieren.
        const normalized = list.map((d) => ({ ...d, groups: normalizeLayout(d.groups) }));
        setDashboards(normalized);
        if (normalized.length > 0) setCurrentId(normalized[0].id);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, []);

  const current = dashboards.find((d) => d.id === currentId) ?? null;

  /** Optimistisch lokal ersetzen + im Backend speichern. */
  const persist = useCallback((next: Dashboard) => {
    setDashboards((list) => list.map((d) => (d.id === next.id ? next : d)));
    updateDashboard(next.id, {
      name: next.name,
      columns: next.columns,
      groups: next.groups,
    }).catch((e) => setError(String(e)));
  }, []);

  /** Hilfsfunktion: Gruppen des aktuellen Dashboards ändern + speichern. */
  const withGroups = useCallback(
    (fn: (groups: Group[]) => Group[]) => {
      if (!current) return;
      persist({ ...current, groups: fn(current.groups) });
    },
    [current, persist],
  );

  const applyGroups = useCallback((groups: Group[]) => withGroups(() => groups), [withGroups]);

  const addWidget = useCallback(
    (entity: EntityInfo, groupId: string) => {
      withGroups((groups) =>
        addWidgetToTarget(groups, groupId, (cell) => ({
          id: genId("w-"),
          type: widgetTypeForDomain(entity.domain),
          entity_id: entity.entity_id,
          title: entity.name,
          x: cell.x,
          y: cell.y,
          w: 1,
          h: 1,
          options: {},
        })),
      );
    },
    [withGroups],
  );

  const removeWidget = useCallback(
    (groupId: string, widgetId: string) => {
      withGroups((groups) =>
        groups.map((g) =>
          g.id === groupId ? { ...g, widgets: g.widgets.filter((w) => w.id !== widgetId) } : g,
        ),
      );
    },
    [withGroups],
  );

  const addSpecialWidget = useCallback(
    (type: string, groupId: string) => {
      withGroups((groups) =>
        addWidgetToTarget(groups, groupId, (cell) => ({
          id: genId("w-"),
          type,
          entity_id: "",
          x: cell.x,
          y: cell.y,
          w: 1,
          h: 1,
          options: {},
        })),
      );
    },
    [withGroups],
  );

  const placeWidgetAt = useCallback(
    (widgetId: string, toGroupId: string, x: number, y: number) => {
      // Ziel ist eine echte Gruppe: intern platzieren + Block ggf. neu einpassen.
      withGroups((groups) => reflowRealGroup(placeWidget(groups, widgetId, toGroupId, x, y), toGroupId));
    },
    [withGroups],
  );

  const placeWidgetLoose = useCallback(
    (widgetId: string, x: number, y: number) => {
      withGroups((groups) => {
        const { groups: gs, targetId } = ensureTarget(groups, UNGROUPED);
        let widget: WidgetConfig | undefined;
        const detached = gs.map((g) => {
          const found = g.widgets.find((w) => w.id === widgetId);
          if (found) widget = { ...found, x, y };
          return { ...g, widgets: g.widgets.filter((w) => w.id !== widgetId) };
        });
        if (!widget) return groups;
        const withWidget = detached.map((g) =>
          g.id === targetId ? { ...g, widgets: [...g.widgets, widget!] } : g,
        );
        return moveBlock(withWidget, widgetId, x, y);
      });
    },
    [withGroups],
  );

  const moveBlockAt = useCallback(
    (blockId: string, x: number, y: number) => {
      withGroups((groups) => moveBlock(groups, blockId, x, y));
    },
    [withGroups],
  );

  const resizeWidget = useCallback(
    (groupId: string, widgetId: string, w: number, h: number) => {
      withGroups((groups) => {
        const resized = resizeWidgetFn(groups, groupId, widgetId, w, h);
        const g = resized.find((gr) => gr.id === groupId);
        if (!g) return resized;
        if (g.ungrouped) {
          // Loses Widget wuchs -> im Dashboard-Raster gegen Gruppen-Blöcke auflösen.
          const wi = g.widgets.find((x) => x.id === widgetId);
          return wi ? moveBlock(resized, widgetId, wi.x, wi.y) : resized;
        }
        return reflowRealGroup(resized, groupId);
      });
    },
    [withGroups],
  );

  const updateWidgetOptions = useCallback(
    (widgetId: string, patch: Record<string, unknown>) => {
      withGroups((groups) =>
        groups.map((g) => ({
          ...g,
          widgets: g.widgets.map((w) =>
            w.id === widgetId ? { ...w, options: { ...w.options, ...patch } } : w,
          ),
        })),
      );
    },
    [withGroups],
  );

  const setGroupColumns = useCallback(
    (groupId: string, columns: number) => {
      const cols = Math.max(1, Math.min(6, columns));
      withGroups((groups) => {
        const updated = groups.map((g) => (g.id === groupId ? { ...g, columns: cols } : g));
        // Breitenänderung kann Nachbarn überlappen -> Block neu einpassen.
        return reflowRealGroup(updated, groupId);
      });
    },
    [withGroups],
  );

  const addGroup = useCallback(
    (name: string) => {
      // Neue Gruppe an die erste freie Stelle im Dashboard-Raster legen.
      withGroups((groups) =>
        normalizeLayout([...groups, { id: genId("g-"), name, columns: 6, widgets: [] }]),
      );
    },
    [withGroups],
  );

  const renameGroup = useCallback(
    (groupId: string, name: string) => {
      withGroups((groups) => groups.map((g) => (g.id === groupId ? { ...g, name } : g)));
    },
    [withGroups],
  );

  const removeGroup = useCallback(
    (groupId: string) => {
      withGroups((groups) => groups.filter((g) => g.id !== groupId));
    },
    [withGroups],
  );

  const createNew = useCallback(async (name: string) => {
    try {
      const created = await createDashboard({
        name,
        columns: 2,
        groups: [{ id: genId("g-"), name: "", columns: 6, widgets: [] }],
      });
      setDashboards((list) => [...list, created]);
      setCurrentId(created.id);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const rename = useCallback(
    (name: string) => {
      if (!current) return;
      persist({ ...current, name });
    },
    [current, persist],
  );

  const removeCurrent = useCallback(async () => {
    if (!current) return;
    const id = current.id;
    try {
      await deleteDashboard(id);
      setDashboards((list) => {
        const next = list.filter((d) => d.id !== id);
        setCurrentId(next[0]?.id ?? null);
        return next;
      });
    } catch (e) {
      setError(String(e));
    }
  }, [current]);

  return {
    dashboards,
    current,
    loading,
    error,
    select: setCurrentId,
    addWidget,
    addSpecialWidget,
    removeWidget,
    placeWidgetAt,
    placeWidgetLoose,
    moveBlockAt,
    resizeWidget,
    updateWidgetOptions,
    applyGroups,
    addGroup,
    renameGroup,
    removeGroup,
    setGroupColumns,
    createNew,
    rename,
    removeCurrent,
  };
}
