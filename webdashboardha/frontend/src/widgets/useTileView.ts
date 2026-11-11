import { useStore } from "../state/store";
import { tileView, type TileView } from "../state/tileState";
import { now } from "../state/clock";
import type { Item } from "../state/model";

/**
 * TileView of one item. The selector returns a JSON string, so the tile only
 * re-renders when its own view changes (not on every state in the stream).
 */
export function useTileView(item: Item | undefined): TileView | null {
  const key = useStore((s) => {
    if (!item) return "";
    const b = s.board;
    return JSON.stringify(
      tileView(item, { get: (id) => s.states[id], now: now(), heating: b?.heating, music: b?.music }),
    );
  });
  return key ? (JSON.parse(key) as TileView) : null;
}
