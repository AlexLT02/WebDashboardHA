import { Press } from "../controls/Press";
import { useMinute } from "../state/clock";
import { allFacts, inboxIds, LIST_TABS, listGroups, newlyPlaced, offlineIds, zoneNameOf } from "../state/alle";
import { useStore } from "../state/store";
import { useUi, type AllTab } from "../state/ui";
import { GroupChip } from "../widgets/GroupChip";
import { InboxRow } from "../widgets/InboxRow";
import { ItemTile } from "./ZoneScreen";
import type { Board } from "../state/model";

function FilterChip({ tab, label, n, sel, edit }: { tab: AllTab; label: string; n?: number; sel: boolean; edit?: boolean }) {
  const go = useUi((s) => s.go);
  return (
    <Press className={`fchip${sel ? " is-sel" : ""}${edit ? " fchip--edit" : ""}`} label={`Filter ${label}`} onPress={() => go({ t: "alle", tab })}>
      {label}
      {n !== undefined ? <span>{String(n)}</span> : null}
    </Press>
  );
}

/** Zone blocks of a list filter: label, chips, tiles (4 columns). */
function Groups({ board, match, zoneLabels }: { board: Board; match: (id: string) => boolean; zoneLabels?: boolean }) {
  const groups = listGroups(board, (item) => match(item.id));
  if (!groups.length) return <div className="alle__empty">Keine Kacheln</div>;
  return (
    <>
      {groups.map((g) => (
        <div key={g.zone || "none"}>
          <div className="label">{g.name}</div>
          {g.chips.length ? (
            <div className="chips">
              {g.chips.map((id) => (
                <GroupChip key={id} item={board.items[id]} />
              ))}
            </div>
          ) : null}
          {g.tiles.length ? (
            <div className="grid4">
              {g.tiles.map((id) => (
                <ItemTile key={id} item={board.items[id]} zoneLabel={zoneLabels ? zoneNameOf(board, board.items[id].zone) : undefined} />
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </>
  );
}

/** Alle -> Neu (mockup 06): inbox rows with zone buttons, then "Neu eingeordnet". */
function NewTab({ board }: { board: Board }) {
  const rows = board.inbox.filter((r) => board.items[r.id]);
  const placed = newlyPlaced(board);
  return (
    <>
      <div className="label">
        Ohne Zone<span>{rows.length ? "Zone antippen, das Gerät zieht dorthin um" : "alles eingeordnet"}</span>
      </div>
      {rows.length ? (
        <div className="inbox">
          {rows.map((r) => (
            <InboxRow key={r.id} row={r} />
          ))}
        </div>
      ) : null}
      {placed.length ? (
        <>
          <div className="label" style={{ marginTop: 22 }}>
            Neu eingeordnet<span>letzte 7 Tage, Markierung verschwindet nach dem ersten Antippen</span>
          </div>
          <div className="grid4">
            {placed.map((id) =>
              board.items[id].chip ? (
                <GroupChip key={id} item={board.items[id]} />
              ) : (
                <ItemTile key={id} item={board.items[id]} zoneLabel={zoneNameOf(board, board.items[id].zone)} />
              ),
            )}
          </div>
        </>
      ) : null}
    </>
  );
}

function HiddenTab({ board }: { board: Board }) {
  const ids = board.hidden.filter((id) => board.items[id]);
  return (
    <>
      <div className="label">
        Ausgeblendet<span>antippen, dann Stufe Zone wählen</span>
      </div>
      {ids.length ? (
        <div className="grid4">
          {ids.map((id) => (
            <ItemTile key={id} item={board.items[id]} zoneLabel={zoneNameOf(board, board.items[id].zone) || "ohne Zone"} />
          ))}
        </div>
      ) : (
        <div className="alle__empty">Nichts ausgeblendet</div>
      )}
    </>
  );
}

/**
 * "Alle" (04 §5.2, §6 P5, mockup 06): title + count line, filter chips
 * Alle · Licht · Ambiente · Medien · Geräte · Klima · Offline N · Neu N
 * (+ Ausgeblendet while editing); below them the only scrolling area.
 */
export function AllScreen() {
  const board = useStore((s) => s.board) as Board;
  const screen = useUi((s) => s.screen);
  const editing = useUi((s) => s.editing);
  const now = useMinute();
  const offKey = useStore((s) => (s.board ? offlineIds(s.board, (id) => s.states[id], now).join(",") : ""));
  const offline = offKey ? offKey.split(",") : [];
  let tab: AllTab = screen.t === "alle" && screen.tab ? screen.tab : "alle";
  if (tab === "hidden" && !editing) tab = "alle";
  const inboxN = inboxIds(board).length;
  const def = LIST_TABS.filter((t) => t.tab === tab)[0];

  let content;
  if (tab === "neu") content = <NewTab board={board} />;
  else if (tab === "hidden") content = <HiddenTab board={board} />;
  else if (tab === "offline") content = <Groups board={board} match={(id) => offline.indexOf(id) !== -1} />;
  else content = <Groups board={board} match={def && def.match ? (id) => def.match!(board.items[id]) : () => true} />;

  return (
    <section className="alle" data-screen="alle" data-tab={tab}>
      <div className="zone__head">
        <div className="zone__title">Alle Geräte</div>
        <div className="zone__facts">{allFacts(board)}</div>
      </div>
      <div className="fchips">
        {LIST_TABS.map((t) => (
          <FilterChip key={t.tab} tab={t.tab} label={t.label} sel={tab === t.tab} />
        ))}
        <FilterChip tab="offline" label="Offline" n={offline.length} sel={tab === "offline"} />
        <FilterChip tab="neu" label="Neu" n={inboxN} sel={tab === "neu"} />
        {editing ? <FilterChip tab="hidden" label="Ausgeblendet" n={board.hidden.length} sel={tab === "hidden"} edit /> : null}
      </div>
      <div className="alle__list" key={tab}>
        {content}
      </div>
    </section>
  );
}
