import { create } from "zustand";
import { lockInput } from "../controls/inputLock";
import { pauseIdle, resumeIdle } from "./idle";

/** Filter of "Alle" (04 §6 P5); "hidden" only while editing. */
export type AllTab = "alle" | "licht" | "ambiente" | "medien" | "geraete" | "klima" | "offline" | "neu" | "hidden";

export type Screen = { t: "start" } | { t: "zone"; id: string } | { t: "alle"; tab?: AllTab };

export type Popup =
  /** Tile popup; `name` overrides the item name (favorites). */
  | { t: "item"; id: string; name?: string }
  /** Kommen & Gehen: Ambiente (count set) or a K&G light group. */
  | { t: "kg"; role: "ambiente" | "group"; id?: string }
  | { t: "covers" }
  | { t: "contacts" }
  | { t: "active" }
  /** Sauger (Lage), optionally for another vacuum entity. */
  | { t: "vacuum"; id?: string }
  | { t: "service" }
  | { t: "settings" }
  | { t: "orphans" }
  /** Bearbeiten-Blatt; `from` decides what ◀ ▶ and the name field change. */
  | { t: "edit"; id: string; from: "fav" | "zone" };

interface UiStore {
  screen: Screen;
  popup: Popup | null;
  closing: boolean;
  /** Bearbeiten mode (04 §5.7): taps open the edit sheet, nothing switches. */
  editing: boolean;
  go: (screen: Screen) => void;
  openPopup: (popup: Popup) => void;
  closePopup: () => void;
  startEdit: () => void;
  endEdit: () => void;
}

const CLOSE_MS = 120;
/** Editing ends on its own after 10 min (04 §5.6). */
export const EDIT_MAX_MS = 10 * 60 * 1000;
let closeTimer: number | undefined;
let editTimer: number | undefined;

/** Screen router + popup slot. Every layer or page change locks input for 300 ms. */
export const useUi = create<UiStore>((set, get) => ({
  screen: { t: "start" },
  popup: null,
  closing: false,
  editing: false,

  go: (screen) => {
    lockInput();
    set({ screen });
  },

  openPopup: (popup) => {
    lockInput();
    window.clearTimeout(closeTimer);
    set({ popup, closing: false });
  },

  closePopup: () => {
    if (!get().popup || get().closing) return;
    lockInput();
    set({ closing: true });
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => set({ popup: null, closing: false }), CLOSE_MS);
  },

  startEdit: () => {
    lockInput();
    pauseIdle("edit");
    window.clearTimeout(editTimer);
    editTimer = window.setTimeout(() => get().endEdit(), EDIT_MAX_MS);
    set({ editing: true });
  },

  endEdit: () => {
    window.clearTimeout(editTimer);
    resumeIdle("edit");
    lockInput();
    const s = get();
    // The hidden filter only exists while editing.
    if (s.screen.t === "alle" && s.screen.tab === "hidden") set({ screen: { t: "alle", tab: "alle" } });
    set({ editing: false });
  },
}));

/** Non-reactive check for gesture handlers. */
export function isEditing(): boolean {
  return useUi.getState().editing;
}
