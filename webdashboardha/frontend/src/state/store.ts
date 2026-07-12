import { create } from "zustand";

export interface EntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

interface DashStore {
  /** Alle Entity-States, gekeyt nach entity_id. */
  states: Record<string, EntityState>;
  /** WebSocket zum Backend verbunden? */
  connected: boolean;
  /** Backend zu HA verbunden? */
  haConnected: boolean;

  applySnapshot: (states: Record<string, EntityState>, haConnected: boolean) => void;
  applyState: (entityId: string, state: EntityState | null) => void;
  setConnected: (connected: boolean) => void;
}

export const useStore = create<DashStore>((set) => ({
  states: {},
  connected: false,
  haConnected: false,

  applySnapshot: (states, haConnected) => set({ states, haConnected }),

  applyState: (entityId, state) =>
    set((prev) => {
      const next = { ...prev.states };
      if (state === null) delete next[entityId];
      else next[entityId] = state;
      return { states: next };
    }),

  setConnected: (connected) => set({ connected }),
}));

/** Selektor-Hook für ein einzelnes Entity (re-rendert nur bei dessen Änderung). */
export function useEntity(entityId: string): EntityState | undefined {
  return useStore((s) => s.states[entityId]);
}
