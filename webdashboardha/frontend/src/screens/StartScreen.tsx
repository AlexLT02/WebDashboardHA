import { useStore } from "../state/store";
import { ItemTile } from "./ZoneScreen";
import { HeadClock } from "../widgets/HeadClock";
import { KgTile } from "../widgets/KgTile";
import { KgCovers } from "../widgets/KgCovers";
import { HoldButton } from "../widgets/HoldButton";
import { Lage } from "../widgets/Lage";
import type { Board, Item, KgEntry } from "../state/model";

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

function Kg({ kg }: { kg: KgEntry }) {
  switch (kg.role) {
    case "ambiente":
    case "group":
      return <KgTile kg={kg} />;
    case "covers":
      return <KgCovers kg={kg} />;
    case "alles_aus":
      return <HoldButton kg={kg} />;
  }
  return null;
}

/**
 * Start (04 §5.2/§5.4, mockup 01): header, Kommen & Gehen, 15 favourites,
 * Lage column. Fits 1024 x 768 without scrolling.
 */
export function StartScreen() {
  const board = useStore((s) => s.board) as Board;
  const favs = favoriteItems(board);
  return (
    <>
      <HeadClock head={board.start.head} />
      <section className="start-left">
        <div className="label">Kommen &amp; Gehen</div>
        <div className="grid3 grid3--kg">
          {board.start.kommen_gehen.map((kg, i) => (
            <Kg key={`${kg.role}-${i}`} kg={kg} />
          ))}
        </div>
        <div className="label">Favoriten</div>
        <div className="grid3">
          {favs.map((f) => (
            <ItemTile key={f.item.id} item={f.item} name={f.name} />
          ))}
        </div>
      </section>
      <Lage />
    </>
  );
}
