import { useStore } from "../state/store";
import { ItemTile } from "./ZoneScreen";
import type { Board } from "../state/model";

function tileIds(board: Board): number {
  let n = 0;
  for (const z of board.zones) {
    for (const s of z.sections) n += s.items.length;
    n += z.all_only.length;
  }
  return n;
}

/**
 * "Alle" (first stage): every tile per zone including "nur Alle", then the
 * items without zone. Filters, inbox actions and editing follow in P5.
 */
export function AllScreen() {
  const board = useStore((s) => s.board) as Board;
  const inbox = board.inbox.filter((r) => board.items[r.id]);
  return (
    <section className="zone" data-screen="alle">
      <div className="zone__head">
        <div className="zone__title">Alle Geräte</div>
        <div className="zone__facts">{`${tileIds(board)} Kacheln in ${board.zones.length} Zonen, ${inbox.length} ohne Zone`}</div>
      </div>
      {board.zones.map((z) => {
        const ids: string[] = [];
        for (const s of z.sections) ids.push(...s.items);
        ids.push(...z.all_only);
        const items = ids.filter((id) => board.items[id]);
        if (!items.length) return null;
        return (
          <div key={z.id}>
            <div className="label">{z.name}</div>
            <div className="grid4">
              {items.map((id) => (
                <ItemTile key={id} item={board.items[id]} />
              ))}
            </div>
          </div>
        );
      })}
      {inbox.length ? (
        <>
          <div className="label">Ohne Zone</div>
          <div className="grid4">
            {inbox.map((r) => (
              <ItemTile key={r.id} item={board.items[r.id]} />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
