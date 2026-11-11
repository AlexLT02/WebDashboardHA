import { Dialog } from "../Dialog";
import { toggleItem } from "../../state/commands";
import { duration, parseNum, pct, temp, watts } from "../../state/format";
import { usePend } from "../../state/pending";
import { useBoard, useStore } from "../../state/store";
import { useTileView } from "../../widgets/useTileView";
import { shownView } from "../../widgets/Tile";
import { InfoRow, footText } from "./common";
import type { Board, EntityState, Item } from "../../state/model";

type Rows = [string, string][];

const SOUND: Record<string, string> = { aus: "aus", tv: "TV", multiroom: "Multiroom" };

function stateText(st: EntityState | undefined): string {
  if (!st) return "–";
  if (st.state === "unavailable") return "Offline";
  if (st.state === "unknown") return "unbekannt";
  return st.state;
}

/** Read-only facts for the kinds whose full popup comes with P4. */
function rowsFor(item: Item, board: Board | null, get: (id: string) => EntityState | undefined): Rows {
  const rows: Rows = [];
  switch (item.kind) {
    case "climate_tuya": {
      const room = item.heating_room ? board?.heating.rooms?.[item.heating_room] : undefined;
      const st = get(item.id);
      rows.push(["Raum", temp(parseNum(room ? get(room.ist)?.state : st?.attributes.current_temperature))]);
      rows.push(["Soll", temp(parseNum(st?.attributes.temperature))]);
      if (room?.reason) rows.push(["Grund", get(room.reason)?.state || "–"]);
      if (board?.heating.mode) rows.push(["Modus", get(board.heating.mode)?.state || "–"]);
      break;
    }
    case "climate": {
      const st = get(item.id);
      rows.push(["Modus", st?.state === "cool" ? "Kühlen" : st?.state === "off" ? "Aus" : stateText(st)]);
      rows.push(["Soll", temp(parseNum(st?.attributes.temperature))]);
      break;
    }
    case "tv": {
      if (item.primary) rows.push(["Fire TV", stateText(get(item.primary))]);
      if (item.tv) rows.push(["Fernseher", stateText(get(item.tv))]);
      const mode = item.sound?.mode ? get(item.sound.mode)?.state : undefined;
      if (mode) rows.push(["Soundanlage", SOUND[mode] || mode]);
      break;
    }
    case "media": {
      const st = get(item.id);
      rows.push(["Zustand", stateText(st)]);
      const title = st?.attributes.media_title || st?.attributes.app_name;
      if (typeof title === "string" && title) rows.push(["Läuft", title]);
      break;
    }
    case "music_room":
    case "multiroom": {
      for (const r of board?.music.rooms || []) {
        const rs = get(r.id);
        const vol = parseNum(rs?.attributes.volume_level);
        rows.push([r.name, !rs || rs.state === "unavailable" ? "Offline" : rs.attributes.is_volume_muted === true ? "Stumm" : pct(vol !== null ? vol * 100 : null)]);
      }
      break;
    }
    case "appliance": {
      rows.push(["Programm", (item.program && get(item.program)?.state) || "–"]);
      const rem = parseNum(item.remaining ? get(item.remaining)?.state : undefined);
      if (rem !== null && rem > 0) rows.push(["Restzeit", `noch ${duration(rem)}`]);
      const prog = parseNum(item.progress ? get(item.progress)?.state : undefined);
      if (prog !== null) rows.push(["Fortschritt", pct(prog)]);
      const w = parseNum(item.power ? get(item.power)?.state : undefined);
      if (w !== null) rows.push(["Leistung", watts(w)]);
      break;
    }
    case "vacuum": {
      const st = get(item.id);
      const bat = parseNum(st?.attributes.battery);
      rows.push(["Zustand", stateText(st)]);
      if (bat !== null) rows.push(["Akku", pct(bat)]);
      break;
    }
  }
  return rows;
}

/** Popup for climate, TV, media, music, appliance, vacuum until P4 builds the full ones. */
export function InfoPopup({ item, name }: { item: Item; name?: string }) {
  const board = useBoard();
  const view = useTileView(item);
  const pend = usePend(item.id);
  // Re-render on any state change of this popup's facts (popup is short-lived).
  const states = useStore((s) => s.states);
  const get = (id: string) => states[id];
  if (!view) return null;
  const shown = shownView(view, pend ? pend.on : null, pend ? pend.phase : null);
  const primary = item.kind === "tv" ? item.primary : item.kind === "appliance" ? item.state : item.id;
  return (
    <Dialog
      name={name || item.name}
      state={shown.status}
      stateOn={shown.on}
      badge={{
        icon: item.icon,
        on: shown.on,
        offline: view.offline,
        onToggle: view.badge && !view.offline ? () => toggleItem(item, view) : undefined,
      }}
      foot={footText(board, item, primary ? get(primary) : undefined)}
    >
      <div className="mrows" style={{ marginTop: 8 }}>
        {rowsFor(item, board, get).map(([k, v]) => (
          <InfoRow key={k} k={k} v={v} />
        ))}
      </div>
    </Dialog>
  );
}
