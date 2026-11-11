import { Dialog } from "../dialogs/Dialog";
import { Press } from "../controls/Press";
import { useStore } from "../state/store";
import { useUi } from "../state/ui";

/**
 * ⚙ panel (04 §5.7), first stage: connection status, reload, settings.
 * "Bearbeiten", "Offline (N)", "Verwaist (N)" follow in P5.
 */
export function ServicePanel() {
  const connected = useStore((s) => s.connected);
  const ha = useStore((s) => s.haConnected);
  const version = useStore((s) => s.version);
  const orphans = useStore((s) => (s.board ? s.board.orphans.length : 0));
  const openPopup = useUi((s) => s.openPopup);
  return (
    <Dialog name="System" left>
      <div className="svc">
        <div className="svc__row">
          Add-on
          <b className={connected ? "ok" : "bad"}>{connected ? "verbunden" : "getrennt"}</b>
        </div>
        <div className="svc__row">
          Home Assistant
          <b className={ha ? "ok" : "bad"}>{ha ? "verbunden" : "getrennt"}</b>
        </div>
        <div className="svc__row">
          Version
          <b>{version || "–"}</b>
        </div>
        <div className="svc__row">
          Verwaist
          <b>{String(orphans)}</b>
        </div>
      </div>
      <div className="qchips qchips--2 svc__btns">
        <Press className="qchip" onPress={() => window.location.reload()}>
          Neu laden
        </Press>
        <Press className="qchip" onPress={() => openPopup({ t: "settings" })}>
          Einstellungen
        </Press>
      </div>
    </Dialog>
  );
}
