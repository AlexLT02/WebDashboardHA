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

export const useStore = create<DashStore>((set) => ({
  states: {},
  lastColors: {},
  connected: false,
  haConnected: false,

  applySnapshot: (states, haConnected) =>
    set((prev) => {
      const lastColors = { ...prev.lastColors };
      for (const id in states) {
        const c = colorOf(states[id]);
        if (c) lastColors[id] = c;
      }
      return { states, haConnected, lastColors };
    }),

  applyState: (entityId, state) =>
    set((prev) => {
      const next = { ...prev.states };
      const lastColors = prev.lastColors;
      if (state === null) {
        delete next[entityId];
        return { states: next };
      }
      next[entityId] = state;
      const c = colorOf(state);
      if (c) return { states: next, lastColors: { ...lastColors, [entityId]: c } };
      return { states: next };
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
