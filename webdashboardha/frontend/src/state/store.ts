import { create } from "zustand";

export interface EntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

type HS = [number, number];

interface DashStore {
  /** Alle Entity-States, gekeyt nach entity_id. */
  states: Record<string, EntityState>;
  /** Zuletzt bekannte Farbe (hs) je Entity — bleibt erhalten, wenn HA sie beim
   *  Ausschalten nicht mehr mitschickt, damit das Farbrad nicht in die Mitte springt. */
  lastColors: Record<string, HS>;
  /** Zuletzt bekannte Weißtemperatur (Kelvin) je Entity — selber Grund. */
  lastTemps: Record<string, number>;
  /** WebSocket zum Backend verbunden? */
  connected: boolean;
  /** Backend zu HA verbunden? */
  haConnected: boolean;

  applySnapshot: (states: Record<string, EntityState>, haConnected: boolean) => void;
  applyState: (entityId: string, state: EntityState | null) => void;
  setConnected: (connected: boolean) => void;
}

/** hs_color aus einem State ziehen, wenn es eine echte Farbe ist (Sättigung > 0). */
function colorOf(state: EntityState): HS | null {
  const hs = state.attributes.hs_color;
  if (Array.isArray(hs) && hs.length === 2 && typeof hs[1] === "number" && hs[1] > 0) {
    return [Number(hs[0]), Number(hs[1])];
  }
  return null;
}

/** Weißtemperatur (Kelvin) aus einem State ziehen, falls vorhanden. */
function tempOf(state: EntityState): number | null {
  const k = state.attributes.color_temp_kelvin;
  return typeof k === "number" ? k : null;
}

export const useStore = create<DashStore>((set) => ({
  states: {},
  lastColors: {},
  lastTemps: {},
  connected: false,
  haConnected: false,

  applySnapshot: (states, haConnected) =>
    set((prev) => {
      const lastColors = { ...prev.lastColors };
      const lastTemps = { ...prev.lastTemps };
      for (const id in states) {
        const c = colorOf(states[id]);
        if (c) lastColors[id] = c;
        const t = tempOf(states[id]);
        if (t) lastTemps[id] = t;
      }
      return { states, haConnected, lastColors, lastTemps };
    }),

  applyState: (entityId, state) =>
    set((prev) => {
      const next = { ...prev.states };
      if (state === null) {
        delete next[entityId];
        return { states: next };
      }
      next[entityId] = state;
      const patch: Partial<DashStore> = { states: next };
      const c = colorOf(state);
      if (c) patch.lastColors = { ...prev.lastColors, [entityId]: c };
      const t = tempOf(state);
      if (t) patch.lastTemps = { ...prev.lastTemps, [entityId]: t };
      return patch;
    }),

  setConnected: (connected) => set({ connected }),
}));

/** Selektor-Hook für ein einzelnes Entity (re-rendert nur bei dessen Änderung). */
export function useEntity(entityId: string): EntityState | undefined {
  return useStore((s) => s.states[entityId]);
}

/** Zuletzt bekannte Farbe (hs) eines Entities, falls vorhanden. */
export function useLastColor(entityId: string): HS | undefined {
  return useStore((s) => s.lastColors[entityId]);
}

/** Zuletzt bekannte Weißtemperatur (Kelvin) eines Entities, falls vorhanden. */
export function useLastTemp(entityId: string): number | undefined {
  return useStore((s) => s.lastTemps[entityId]);
}
