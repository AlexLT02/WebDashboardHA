import { useStore } from "../state/store";
import { ItemTile } from "./ZoneScreen";
import type { Board, Item } from "../state/model";

/** Favourite entry merged with its item (name and kind come from the favourite). */
export function favoriteItems(board: Board): { item: Item; name: string }[] {
  const out: { item: Item; name: string }[] = [];
  for (const f of board.start.favorites.slice(0, 15)) {
    const item = board.items[f.id];
    if (!item) continue;
    out.push({ item: f.kind && f.kind !== item.kind ? { ...item, kind: f.kind } : item, name: f.name });
  }
  return out;
}

/** Start (P2 stage): favourites only. Header, K&G and Lage follow in P3. */
export function StartScreen() {
  const board = useStore((s) => s.board) as Board;
  const favs = favoriteItems(board);
  return (
    <section className="start-left" style={{ top: 122 }}>
      <div className="label">Favoriten</div>
      <div className="grid3">
        {favs.map((f) => (
          <ItemTile key={f.item.id} item={f.item} name={f.name} />
        ))}
      </div>
    </section>
  );
}
