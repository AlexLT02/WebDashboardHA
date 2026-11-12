import { create } from "zustand";
import { fetchDashboards, saveDashboard, type DashboardDoc } from "./api";

/**
 * UI settings from `meta.settings` of the first dashboard ("default").
 * Replaces the 1.4.2 board hook: groups, widgets and categories stay in the
 * file untouched, so going back to 1.4.2 keeps working (04 §3).
 */
export interface Settings {
  night: boolean;
  nightStart: string;
  nightEnd: string;
  /** Kept for the current NightShade until P6 replaces it (D13). */
  nightDim: number;
  nightFadeSec: number;
  /** D14 (P6): brightness for icon-switched lights at night, 0 = off. */
  nightOnPct: number;
  alertSwitchEntity: string;
  alertTextEntity: string;
  alertLevelEntity: string;
  alertSlotPrefix: string;
  alertIndexEntity: string;
  alertAckScript: string;
  /** P8: snowfall layer, "auto" = December to February. */
  snow: SnowMode;
  /** Accent colour as hex, see state/accent.ts. */
  accent: string;
}

export type SnowMode = "auto" | "on" | "off";

export const DEFAULT_SETTINGS: Settings = {
  night: false,
  nightStart: "22:00",
  nightEnd: "06:30",
  nightDim: 0.85,
  nightFadeSec: 900,
  nightOnPct: 15,
  alertSwitchEntity: "input_boolean.dashboard_alert",
  alertTextEntity: "input_text.dashboard_alert_text",
  alertLevelEntity: "input_select.dashboard_alert_level",
  alertSlotPrefix: "input_text.wdh_slot_",
  alertIndexEntity: "input_number.wdh_index",
  alertAckScript: "script.wdh_ack",
  snow: "auto",
  accent: "#ef936b",
};

interface SettingsStore {
  doc: DashboardDoc | null;
  settings: Settings;
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

function merge(doc: DashboardDoc | null): Settings {
  return { ...DEFAULT_SETTINGS, ...((doc?.meta?.settings as Partial<Settings>) || {}) };
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  doc: null,
  settings: DEFAULT_SETTINGS,
  loaded: false,
  error: null,

  load: async () => {
    try {
      const list = await fetchDashboards();
      const doc = list.filter((d) => d.id === "default")[0] || list[0] || null;
      set({ doc, settings: merge(doc), loaded: true, error: null });
    } catch (e) {
      set({ loaded: true, error: String(e) });
    }
  },

  set: (key, value) => {
    const { doc, settings } = get();
    const next = { ...settings, [key]: value };
    set({ settings: next });
    if (!doc) return;
    const updated: DashboardDoc = {
      ...doc,
      meta: { ...(doc.meta || {}), settings: { ...((doc.meta?.settings as object) || {}), [key]: value } },
    };
    set({ doc: updated });
    saveDashboard(updated).catch((e) => set({ error: String(e) }));
  },
}));

export function useSettings(): Settings {
  return useSettingsStore((s) => s.settings);
}
