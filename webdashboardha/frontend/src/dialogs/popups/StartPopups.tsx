import { Dialog } from "../Dialog";
import { Icon } from "../../controls/icons";
import { Press } from "../../controls/Press";
import { runOff, runOn, toggleItem } from "../../state/commands";
import { coverStatus, coversSummary } from "../../state/cover";
import { hhmm } from "../../state/format";
import { usePend } from "../../state/pending";
import { useStore } from "../../state/store";
import { tileView } from "../../state/tileState";
import { useTileView } from "../../widgets/useTileView";
import { kgItem } from "../../widgets/KgTile";
import { shownView } from "../../widgets/Tile";
import { CoverButtons } from "../../widgets/CoverWide";
import { GroupBody } from "./GroupPopup";
import { MemberRow } from "./common";
import type { Board, KgAmbiente, KgCovers, KgGroup } from "../../state/model";

/** K&G popup: Ambiente (count set, D6) or Wohnlicht / Licht hinten with group slider. */
export function KgPopup({ role, id }: { role: "ambiente" | "group"; id?: string }) {
  const board = useStore((s) => s.board) as Board;
  const kg = board.start.kommen_gehen.filter((k) => k.role === role && (role === "ambiente" || (k as KgGroup).id === id))[0] as
    | KgAmbiente
    | KgGroup
    | undefined;
  const item = kg ? kgItem(kg) : undefined;
  const view = useTileView(item);
  const pend = usePend(item ? item.id : "");
  if (!kg || !item || !view) return null;
  const shown = shownView(view, pend ? pend.on : null, pend ? pend.phase : null);
  const toggle = () => {
    if (kg.role === "group") return toggleItem(item, view);
    if (view.on) runOff({ scope: "ambiente" }, item);
    else runOn(item, { scope: "ambiente" });
  };
  return (
    <Dialog name={kg.name} state={shown.status} stateOn={shown.on} badge={{ icon: item.icon, on: shown.on, offline: view.offline, onToggle: view.offline ? undefined : toggle }}>
      <GroupBody
        members={kg.role === "ambiente" ? kg.count : kg.members}
        sliderEntity={kg.role === "group" ? kg.id : undefined}
        cloud={item.cloud}
      />
    </Dialog>
  );
}

interface ContactRow {
  id: string;
  name: string;
  open: boolean;
  since: number | null;
}

function contactRows(board: Board, states: Record<string, { state: string; lc_ts?: number | null }>): ContactRow[] {
  const out: ContactRow[] = [];
  for (const b of board.start.lage) {
    if (b.key !== "oeffnungen") continue;
    for (const c of (b.contacts as { id: string; name: string }[]) || []) {
      const st = states[c.id];
      out.push({ id: c.id, name: c.name, open: st?.state === "on", since: st && typeof st.lc_ts === "number" ? st.lc_ts : null });
    }
  }
  // Open ones first, keep the configured order otherwise.
  return out.filter((r) => r.open).concat(out.filter((r) => !r.open));
}

/** Kontakte (04 §5.5): 7 rows of 56 px, open first. */
export function ContactsPopup() {
  const board = useStore((s) => s.board) as Board;
  const key = useStore((s) => JSON.stringify(contactRows(board, s.states)));
  const rows = JSON.parse(key) as ContactRow[];
  const open = rows.filter((r) => r.open).length;
  return (
    <Dialog name="Fenster und Türen" state={open ? `${open} offen` : "alles zu"}>
      <div className="mrows" style={{ marginTop: 8 }}>
        {rows.map((r) => (
          <div key={r.id} className={`mrow mrow--56${r.open ? " is-open" : ""}`} data-id={r.id}>
            <div className="badge badge--bare">
              <Icon name={/fenster/i.test(r.name) ? "window" : /kühl|gefrier/i.test(r.name) ? "fridge" : "door"} />
            </div>
            <div className="mrow__name">{r.name}</div>
            <div className={`mrow__v${r.open ? " red" : ""}`}>{r.open ? (r.since !== null ? `Offen seit ${hhmm(r.since)}` : "Offen") : "zu"}</div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

const GROUP_KINDS: Record<string, number> = { group: 1, switch_group: 1 };

/** All counted items that are on, in board order. */
export function activeIds(board: Board, states: Record<string, { state: string }>): string[] {
  const out: string[] = [];
  for (const id in board.items) {
    const it = board.items[id];
    if (!it.count || GROUP_KINDS[it.kind] || it.tier === "hidden" || id.indexOf("virtual.") === 0) continue;
    if (tileView(it, { get: (e) => states[e] as never, now: 0, heating: board.heating, music: board.music }).on) out.push(id);
  }
  return out;
}

const ACTIVE_MAX = 18;

/** Was ist an? (04 §5.5): every counted item that is on, with its own toggle. */
export function ActivePopup() {
  const board = useStore((s) => s.board) as Board;
  const key = useStore((s) => activeIds(board, s.states).join(","));
  const ids = key ? key.split(",") : [];
  const lightsOn = ids.filter((id) => id.indexOf("light.") === 0).length;
  const shown = ids.slice(0, ACTIVE_MAX);
  return (
    <Dialog name="Was ist an?" state={ids.length ? `${ids.length} an` : "alles aus"} stateOn={ids.length > 0}>
      <Press
        className={`bigsw${lightsOn ? "" : " is-disabled"}`}
        disabled={!lightsOn}
        label="Alle Lichter aus"
        onPress={() => runOff({ scope: "lights" })}
      >
        {lightsOn ? `Alle Lichter aus (${lightsOn})` : "Alle Lichter sind aus"}
      </Press>
      <div className={`mrows${shown.length > 8 ? " mrows--2" : ""}`}>
        {shown.map((id) => (
          <MemberRow key={id} id={id} />
        ))}
      </div>
      {ids.length > ACTIVE_MAX ? <div className="popup__note">{`und ${ids.length - ACTIVE_MAX} weitere`}</div> : null}
    </Dialog>
  );
}

/** Alle Rollläden (04 §5.5): one row per cover with ▲ ■ ▼, plus "Alle". */
export function CoversPopup() {
  const board = useStore((s) => s.board) as Board;
  const kg = board.start.kommen_gehen.filter((k) => k.role === "covers")[0] as KgCovers | undefined;
  const key = useStore((s) =>
    kg
      ? JSON.stringify(
          kg.covers.map((c) => {
            const st = s.states[c.id];
            return { id: c.id, st: st ? st.state : "", status: !st || st.state === "unavailable" ? "Offline" : coverStatus(st, false) };
          }),
        )
      : "[]",
  );
  if (!kg) return null;
  const rows = JSON.parse(key) as { id: string; st: string; status: string }[];
  const summary = useStore.getState().states;
  return (
    <Dialog name={kg.name} state={coversSummary(kg.covers.map((c) => ({ short: c.short, st: summary[c.id] })))}>
      <div className="mrows" style={{ marginTop: 8 }}>
        {rows.map((r, i) => (
          <div key={r.id} className="mrow mrow--56" data-id={r.id}>
            <div className="badge badge--bare">
              <Icon name="blinds" />
            </div>
            <div className="mrow__name">{kg.covers[i].short}</div>
            <div className="mrow__sub">{r.status}</div>
            <CoverButtons ids={r.id} moving={r.st} label={kg.covers[i].short} />
          </div>
        ))}
        <div className="mrow mrow--56" data-id="covers.all">
          <div className="badge badge--bare">
            <Icon name="blinds" />
          </div>
          <div className="mrow__name">Alle</div>
          <div className="mrow__sub">{`${rows.length} Rollläden`}</div>
          <CoverButtons ids={kg.covers.map((c) => c.id)} label="Alle" />
        </div>
      </div>
      <div className="popup__note">Zustand geschätzt, die Rollläden melden keine Position.</div>
    </Dialog>
  );
}
