import { useState } from "react";
import { Icon } from "../controls/icons";
import { Press } from "../controls/Press";
import { patchItem } from "../state/api";
import { showText } from "../state/notice";
import { useBoard } from "../state/store";
import { useUi } from "../state/ui";
import { useTileView } from "./useTileView";
import type { InboxRow as InboxRowT } from "../state/model";

/**
 * Eingangskorb row 80 px (04 §5.7, mockup 06): icon, name, "device, model,
 * state", zone buttons (suggestion in blue) and "Ausblenden". Works without
 * the edit mode; it only writes the add-on's zones.json (D5). Icon and name
 * open the device popup, so a device can be identified before sorting it.
 */
export function InboxRow({ row }: { row: InboxRowT }) {
  const board = useBoard();
  const item = board ? board.items[row.id] : undefined;
  const view = useTileView(item);
  const openPopup = useUi((s) => s.openPopup);
  const [busy, setBusy] = useState<string | null>(null);
  if (!board || !item || !view) return null;
  const send = (key: string, patch: Parameters<typeof patchItem>[1]) => {
    if (busy) return;
    setBusy(key);
    // The new board arrives over the WebSocket; the row disappears with it.
    patchItem(row.id, patch).catch(() => {
      setBusy(null);
      showText("Fehlgeschlagen, nichts geändert", "amber");
    });
  };
  const sub = [row.device, row.model, view.status].filter((s) => s).join(", ");
  return (
    <div className={`inrow${busy ? " is-busy" : ""}`} data-id={row.id}>
      <Press className="inrow__id" label={`${row.name} öffnen`} onPress={() => openPopup({ t: "item", id: row.id })}>
        <div className="badge badge--bare">
          <Icon name={item.icon} />
        </div>
        <div className="inrow__t">
          <div className="tile__name">{row.name}</div>
          <div className="tile__sub">{sub}</div>
        </div>
      </Press>
      <div className="inrow__z">
        {board.zones.map((z) => (
          <Press
            key={z.id}
            className={`zbtn${row.suggest === z.id ? " is-sug" : ""}${busy === z.id ? " is-sel" : ""}`}
            label={`${row.name} nach ${z.name}`}
            onPress={() => send(z.id, { zone: z.id })}
          >
            {z.name}
          </Press>
        ))}
        <Press className="zbtn zbtn--quiet" label={`${row.name} ausblenden`} onPress={() => send("hidden", { tier: "hidden" })}>
          Ausblenden
        </Press>
      </div>
    </div>
  );
}
