import { useCallback, useEffect, useState } from "react";
import {
  createDashboard,
  deleteDashboard,
  fetchDashboards,
  updateDashboard,
  widgetTypeForDomain,
  type CustomCategory,
  type Dashboard,
  type DashboardMeta,
  type EntityInfo,
  type Group,
  type WidgetConfig,
} from "./dashboards";
import { categoryForDomain, customCategories } from "./board";

/** Kollisionsarme ID ohne crypto.randomUUID (fehlt auf Safari 12). */
function genId(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Jedes Widget des Dashboards (über alle Gruppen), inkl. Nicht-Kachel-Widgets. */
function collectWidgets(dashboard: Dashboard): WidgetConfig[] {
  const out: WidgetConfig[] = [];
  for (const g of dashboard.groups) out.push(...g.widgets);
  return out;
}

/**
 * Auf eine kanonische Ein-Gruppen-Struktur normalisieren. Das neue Design
 * gruppiert rein logisch nach Kategorie; die Gruppen-Ebene der Persistenz
 * brauchen wir nur noch als flachen Container. Migriert Alt-Dashboards
 * (mehrere Gruppen / Raster-Positionen) beim ersten Speichern transparent.
 */
function canonicalGroups(dashboard: Dashboard, widgets: WidgetConfig[]): Group[] {
  const id = dashboard.groups[0]?.id ?? genId("g-");
  return [{ id, name: "", icon: "", columns: 6, ungrouped: false, x: 0, y: 0, widgets }];
}

export interface BoardSettings {
  screensaver: boolean;
  kiosk: boolean;
}

export interface BoardApi {
  dashboards: Dashboard[];
  current: Dashboard | null;
  loading: boolean;
  error: string | null;
  settings: BoardSettings;
  select: (id: string) => void;
  /** Gerät hinzufügen; optional in eine bestimmte (ggf. abweichende) Kategorie. */
  addWidget: (entity: EntityInfo, categoryKey?: string) => void;
  removeWidget: (widgetId: string) => void;
  updateWidgetOptions: (widgetId: string, patch: Record<string, unknown>) => void;
  /** Custom-Kategorie anlegen; gibt den neuen Key zurück (oder null bei leerem Namen). */
  addCategory: (name: string, icon: string) => string | null;
  /** Custom-Kategorie entfernen; darin einsortierte Geräte fallen auf ihre Domain-Kategorie zurück. */
  removeCategory: (key: string) => void;
  setSetting: (key: keyof BoardSettings, value: boolean) => void;
  rename: (name: string) => void;
  createNew: (name: string) => Promise<void>;
  removeCurrent: () => Promise<void>;
}

const DEFAULT_SETTINGS: BoardSettings = { screensaver: false, kiosk: true };

export function useBoard(): BoardApi {
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

  /** Optimistisch lokal ersetzen + im Backend speichern (kanonisch normalisiert). */
  const persist = useCallback((next: Dashboard) => {
    setDashboards((list) => list.map((d) => (d.id === next.id ? next : d)));
    updateDashboard(next.id, {
      name: next.name,
      columns: next.columns,
      groups: next.groups,
      meta: next.meta ?? {},
    }).catch((e) => setError(String(e)));
  }, []);

  /** Widgets des aktuellen Dashboards transformieren + speichern. */
  const withWidgets = useCallback(
    (fn: (widgets: WidgetConfig[]) => WidgetConfig[]) => {
      if (!current) return;
      const next = fn(collectWidgets(current));
      persist({ ...current, groups: canonicalGroups(current, next) });
    },
    [current, persist],
  );

  /** meta des aktuellen Dashboards transformieren + speichern. */
  const withMeta = useCallback(
    (fn: (meta: DashboardMeta) => DashboardMeta) => {
      if (!current) return;
      const next = fn(current.meta ?? {});
      persist({
        ...current,
        groups: canonicalGroups(current, collectWidgets(current)),
        meta: next,
      });
    },
    [current, persist],
  );

  const addWidget = useCallback(
    (entity: EntityInfo, categoryKey?: string) => {
      withWidgets((widgets) => {
        // Kein doppeltes Entity auf demselben Dashboard.
        if (entity.entity_id && widgets.some((w) => w.entity_id === entity.entity_id)) {
          return widgets;
        }
        const options: Record<string, unknown> = {};
        if (categoryKey && categoryKey !== categoryForDomain(entity.domain)) {
          options.category = categoryKey;
        }
        const widget: WidgetConfig = {
          id: genId("w-"),
          type: widgetTypeForDomain(entity.domain),
          entity_id: entity.entity_id,
          title: entity.name,
          x: 0,
          y: 0,
          w: 1,
          h: 1,
          options,
        };
        return [...widgets, widget];
      });
    },
    [withWidgets],
  );

  const removeWidget = useCallback(
    (widgetId: string) => {
      withWidgets((widgets) => widgets.filter((w) => w.id !== widgetId));
    },
    [withWidgets],
  );

  const updateWidgetOptions = useCallback(
    (widgetId: string, patch: Record<string, unknown>) => {
      withWidgets((widgets) =>
        widgets.map((w) =>
          w.id === widgetId ? { ...w, options: { ...w.options, ...patch } } : w,
        ),
      );
    },
    [withWidgets],
  );

  const addCategory = useCallback(
    (name: string, icon: string): string | null => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const key = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const cat: CustomCategory = { key, name: trimmed, icon: icon || "light" };
      withMeta((meta) => ({
        ...meta,
        customCategories: [...customCategories(meta), cat],
      }));
      return key;
    },
    [withMeta],
  );

  const removeCategory = useCallback(
    (key: string) => {
      if (!current) return;
      // Geräte dieser Kategorie auf ihre Domain-Kategorie zurückfallen lassen.
      const widgets = collectWidgets(current).map((w) => {
        if (w.options?.category === key) {
          const opts = { ...(w.options as Record<string, unknown>) };
          delete opts.category;
          return { ...w, options: opts };
        }
        return w;
      });
      const meta: DashboardMeta = {
        ...(current.meta ?? {}),
        customCategories: customCategories(current.meta).filter((c) => c.key !== key),
      };
      persist({ ...current, groups: canonicalGroups(current, widgets), meta });
    },
    [current, persist],
  );

  const setSetting = useCallback(
    (key: keyof BoardSettings, value: boolean) => {
      withMeta((meta) => ({
        ...meta,
        settings: { ...DEFAULT_SETTINGS, ...meta.settings, [key]: value },
      }));
    },
    [withMeta],
  );

  const rename = useCallback(
    (name: string) => {
      if (!current) return;
      persist({
        ...current,
        name,
        groups: canonicalGroups(current, collectWidgets(current)),
      });
    },
    [current, persist],
  );

  const createNew = useCallback(async (name: string) => {
    try {
      const created = await createDashboard({
        name: name.trim() || "Neues Dashboard",
        columns: 2,
        groups: [{ id: genId("g-"), name: "", icon: "", columns: 6, widgets: [] }],
        meta: {},
      });
      setDashboards((list) => [...list, created]);
      setCurrentId(created.id);
    } catch (e) {
      setError(String(e));
    }
  }, []);

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

  const settings: BoardSettings = { ...DEFAULT_SETTINGS, ...(current?.meta?.settings ?? {}) };

  return {
    dashboards,
    current,
    loading,
    error,
    settings,
    select: setCurrentId,
    addWidget,
    removeWidget,
    updateWidgetOptions,
    addCategory,
    removeCategory,
    setSetting,
    rename,
    createNew,
    removeCurrent,
  };
}
