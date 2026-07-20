import { Dialog } from "./Dialog";

/**
 * Kalender-Anbindung ist noch nicht implementiert (kein Backend dafür). Bewusst
 * ehrlicher Platzhalter statt einer erfundenen „verbunden"-Anzeige.
 */
export function CalendarDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Kalender verbinden" onClose={onClose}>
      <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "#9aa2b1", margin: "0 0 18px" }}>
        Termine &amp; Erinnerungen direkt auf dem Dashboard — die Kalender-Anbindung
        (Google / CalDAV) ist vorbereitet, aber noch nicht aktiv. Sobald das
        Backend einen Kalender bereitstellt, erscheinen die Termine hier
        automatisch.
      </p>
      <div className="dlg__setting" style={{ marginBottom: 0 }}>
        <div>
          <div className="dlg__setting-t">Kalenderquelle</div>
          <div className="dlg__setting-d">Noch nicht verbunden</div>
        </div>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-dim)" }}>Bald</span>
      </div>
    </Dialog>
  );
}
