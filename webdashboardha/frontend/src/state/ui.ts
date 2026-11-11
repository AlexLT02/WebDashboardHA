import { create } from "zustand";
import { lockInput } from "../controls/inputLock";

export type Screen = { t: "start" } | { t: "zone"; id: string } | { t: "alle"; tab?: string };

export type Popup =
  /** Tile popup; `name` overrides the item name (favorites). */
  | { t: "item"; id: string; name?: string }
  /** Kommen & Gehen: Ambiente (count set) or a K&G light group. */
  | { t: "kg"; role: "ambiente" | "group"; id?: string }
  | { t: "covers" }
  | { t: "contacts" }
  | { t: "active" }
  | { t: "service" }
  | { t: "settings" };

interface UiStore {
  screen: Screen;
  popup: Popup | null;
  closing: boolean;
  go: (screen: Screen) => void;
  openPopup: (popup: Popup) => void;
  closePopup: () => void;
}

const CLOSE_MS = 120;
let closeTimer: number | undefined;

/** Screen router + popup slot. Every layer or page change locks input for 300 ms. */
export const useUi = create<UiStore>((set, get) => ({
  screen: { t: "start" },
  popup: null,
  closing: false,

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
}));
