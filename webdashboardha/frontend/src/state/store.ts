import { create } from "zustand";
import type { Board, EntityState } from "./model";

export type { EntityState } from "./model";

type HS = [number, number];

interface DashStore {
  /** Watch-set states from /ws?v=2, keyed by entity_id. */
  states: Record<string, EntityState>;
  /** Last known hs colour per entity (HA drops it when the light goes off). */
  lastColors: Record<string, HS>;
  /** Last known colour temperature (kelvin) per entity. */
  lastTemps: Record<string, number>;
  board: Board | null;
  rev: number;
  /** Backend version from the hello message. */
  version: string | null;
  /** WebSocket to the add-on backend is open. */
  connected: boolean;
  /** Backend is connected to HA. */
  haConnected: boolean;

  applyHello: (version: string, haConnected: boolean) => void;
  applyBoard: (board: Board, rev: number) => void;
  applySnapshot: (states: Record<string, EntityState>) => void;
  applyState: (entityId: string, state: EntityState | null) => void;
  setConnected: (connected: boolean) => void;
  setHaConnected: (connected: boolean) => void;
}

function colorOf(state: EntityState): HS | null {
  const hs = state.attributes.hs_color;
  if (Array.isArray(hs) && hs.length === 2 && typeof hs[1] === "number" && hs[1] > 0) {
    return [Number(hs[0]), Number(hs[1])];
  }
  return null;
}

function tempOf(state: EntityState): number | null {
  const k = state.attributes.color_temp_kelvin;
  return typeof k === "number" ? k : null;
}

export const useStore = create<DashStore>((set) => ({
  states: {},
  lastColors: {},
  lastTemps: {},
  board: null,
  rev: 0,
  version: null,
  connected: false,
  haConnected: false,

  applyHello: (version, haConnected) => set({ version, haConnected }),

  applyBoard: (board, rev) => set({ board: { ...board, rev }, rev }),

  applySnapshot: (states) =>
    set((prev) => {
      const lastColors = { ...prev.lastColors };
      const lastTemps = { ...prev.lastTemps };
      for (const id in states) {
        const c = colorOf(states[id]);
        if (c) lastColors[id] = c;
        const t = tempOf(states[id]);
        if (t) lastTemps[id] = t;
      }
      return { states, lastColors, lastTemps, haConnected: true };
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
  setHaConnected: (haConnected) => set({ haConnected }),
}));

/** Selector hook for a single entity (re-renders only when it changes). */
export function useEntity(entityId: string | undefined): EntityState | undefined {
  return useStore((s) => (entityId ? s.states[entityId] : undefined));
}

export function useLastColor(entityId: string): HS | undefined {
  return useStore((s) => s.lastColors[entityId]);
}

export function useLastTemp(entityId: string): number | undefined {
  return useStore((s) => s.lastTemps[entityId]);
}

/** Non-reactive getter for pure helpers. */
export function getState(entityId: string): EntityState | undefined {
  return useStore.getState().states[entityId];
}

export function useBoard(): Board | null {
  return useStore((s) => s.board);
}
