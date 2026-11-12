import { Dialog } from "../dialogs/Dialog";
import { Press } from "../controls/Press";
import { useMinute } from "../state/clock";
import { offlineIds } from "../state/alle";
import { useStore } from "../state/store";
import { useUi } from "../state/ui";

/**
 * ⚙ panel (04 §5.7): HA status (add-on, HA, version), Neu laden,
 * Einstellungen, Bearbeiten, Offline (N) -> Alle/Offline, Verwaist (N).
 */
export function ServicePanel() {
  const connected = useStore((s) => s.connected);
  const ha = useStore((s) => s.haConnected);
  const version = useStore((s) => s.version);
  const orphans = useStore((s) => (s.board ? s.board.orphans.length : 0));
  const now = useMinute();
  const offline = useStore((s) => (s.board ? offlineIds(s.board, (id) => s.states[id], now).length : 0));
  const openPopup = useUi((s) => s.openPopup);
  const closePopup = useUi((s) => s.closePopup);
  const go = useUi((s) => s.go);
  const startEdit = useUi((s) => s.startEdit);
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
      </div>
      <div className="qchips qchips--2 svc__btns">
        <Press className="qchip" onPress={() => window.location.reload()}>
          Neu laden
        </Press>
        <Press className="qchip" onPress={() => openPopup({ t: "settings" })}>
          Einstellungen
        </Press>
        <Press
          className="qchip"
          label="Bearbeiten"
          onPress={() => {
            closePopup();
            startEdit();
          }}
        >
          Bearbeiten
        </Press>
        <Press
          className={`qchip${offline ? "" : " is-disabled"}`}
          disabled={!offline}
          label="Offline-Geräte"
          onPress={() => {
            closePopup();
            go({ t: "alle", tab: "offline" });
          }}
        >
          {`Offline (${offline})`}
        </Press>
        <Press className={`qchip${orphans ? "" : " is-disabled"}`} disabled={!orphans} label="Verwaiste Einträge" onPress={() => openPopup({ t: "orphans" })}>
          {`Verwaist (${orphans})`}
        </Press>
      </div>
    </Dialog>
  );
}

/** Entries of the start configuration whose entity is gone or disabled in HA. */
export function OrphansPopup() {
  const orphans = useStore((s) => (s.board ? s.board.orphans : []));
  return (
    <Dialog name="Verwaist" state={orphans.length ? `${orphans.length} Einträge ohne Gerät` : "keine"} left>
      <div className="mrows" style={{ marginTop: 8 }}>
        {orphans.slice(0, 10).map((o) => (
          <div key={`${o.id}|${o.where}`} className="mrow" style={{ paddingLeft: 8 }}>
            <div className="mrow__name" style={{ left: 8, fontWeight: 400, fontSize: 14 }}>{o.id}</div>
            <div className="mrow__sub" style={{ left: 8 }}>{`eingetragen in ${o.where}`}</div>
          </div>
        ))}
      </div>
      {orphans.length > 10 ? <div className="popup__note">{`und ${orphans.length - 10} weitere`}</div> : null}
      <div className="popup__note">In HA umbenannt oder gelöscht. Die Kachel fehlt, bis die Startbelegung angepasst ist.</div>
    </Dialog>
  );
}
