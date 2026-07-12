import { useCallback, useEffect, useState } from "react";
import {
  createDashboard,
  deleteDashboard,
  fetchDashboards,
  updateDashboard,
  widgetTypeForDomain,
  type Dashboard,
  type EntityInfo,
  type Group,
  type WidgetConfig,
} from "./dashboards";
import { firstFreeCell, moveGroup as moveGroupFn, placeWidget } from "./grid";

/** Kollisionsarme ID ohne crypto.randomUUID (fehlt auf Safari 12). */
function genId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export interface DashboardsApi {
  dashboards: Dashboard[];
  current: Dashboard | null;
  loading: boolean;
  error: string | null;
  select: (id: string) => void;
  // Widgets
  addWidget: (entity: EntityInfo, groupId: string) => void;
  removeWidget: (groupId: string, widgetId: string) => void;
  /** Widget per Drag&Drop auf Zelle (x,y) einer (ggf. anderen) Gruppe legen. */
  placeWidgetAt: (widgetId: string, toGroupId: string, x: number, y: number) => void;
  /** Ganze Gruppen-Struktur ersetzen + speichern. */
  applyGroups: (groups: Group[]) => void;
  // Gruppen
  addGroup: (name: string) => void;
  renameGroup: (groupId: string, name: string) => void;
  removeGroup: (groupId: string) => void;
  setGroupColumns: (groupId: string, columns: number) => void;
  moveGroup: (groupId: string, dir: -1 | 1) => void;
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
        setDashboards(list);
        if (list.length > 0) setCurrentId(list[0].id);
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
        groups.map((g) => {
          if (g.id !== groupId) return g;
          const cell = firstFreeCell(g);
          const widget: WidgetConfig = {
            id: genId("w-"),
            type: widgetTypeForDomain(entity.domain),
            entity_id: entity.entity_id,
            title: entity.name,
            x: cell.x,
            y: cell.y,
            w: 1,
            h: 1,
            options: {},
          };
          return { ...g, widgets: [...g.widgets, widget] };
        }),
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

  const placeWidgetAt = useCallback(
    (widgetId: string, toGroupId: string, x: number, y: number) => {
      withGroups((groups) => placeWidget(groups, widgetId, toGroupId, x, y));
    },
    [withGroups],
  );

  const setGroupColumns = useCallback(
    (groupId: string, columns: number) => {
      const cols = Math.max(1, Math.min(8, columns));
      withGroups((groups) =>
        groups.map((g) => (g.id === groupId ? { ...g, columns: cols } : g)),
      );
    },
    [withGroups],
  );

  const moveGroup = useCallback(
    (groupId: string, dir: -1 | 1) => {
      withGroups((groups) => moveGroupFn(groups, groupId, dir));
    },
    [withGroups],
  );

  const addGroup = useCallback(
    (name: string) => {
      withGroups((groups) => [...groups, { id: genId("g-"), name, columns: 4, widgets: [] }]);
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
        groups: [{ id: genId("g-"), name: "", columns: 4, widgets: [] }],
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
    removeWidget,
    placeWidgetAt,
    applyGroups,
    addGroup,
    renameGroup,
    removeGroup,
    setGroupColumns,
    moveGroup,
    createNew,
    rename,
    removeCurrent,
  };
}
