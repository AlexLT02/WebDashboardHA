import { useEffect, useState } from "react";
import { useEntity } from "../state/store";
import { callService } from "../state/service";
import { isAlertOn, resolveAlert, type AlertLevel } from "../state/alert";
import type { BoardSettings } from "../state/useBoard";

interface Props {
  settings: BoardSettings;
}

/** Ersatztext, falls der input_text leer ist — je Stufe. */
const FALLBACK: Record<AlertLevel, string> = {
  wichtig: "Achtung",
  warnung: "Warnung",
  hinweis: "Hinweis",
};

/** Warndreieck (wichtig/warnung) bzw. Info-Kreis (hinweis), erbt die Level-Farbe. */
function AlertIcon({ level }: { level: AlertLevel }) {
  if (level === "hinweis") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2 1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2V9h2v4z" />
    </svg>
  );
}

/**
 * Vollbild-Warnmeldung. Liegt über allem (auch über dem Nachtmodus), Hintergrund
 * dunkel — nur Schrift und Icon tragen die Dringlichkeitsfarbe und pulsieren.
 *
 * Sichtbarkeit = `input_boolean == on`. Der OK-Button schaltet den Switch aus;
 * schaltet HA ihn selbst aus, verschwindet die Meldung genauso. Damit die
 * Reaktion auf dem iPad sofort kommt, wird lokal optimistisch quittiert — geht
 * der Service-Call schief, taucht die Meldung wieder auf.
 */
export function AlertOverlay({ settings }: Props) {
  const { alertSwitchEntity, alertTextEntity, alertLevelEntity } = settings;
  const sw = useEntity(alertSwitchEntity);
  const txt = useEntity(alertTextEntity);
  const lvl = useEntity(alertLevelEntity);

  const [acked, setAcked] = useState(false);

  // Jede echte Zustandsänderung aus HA hebt die lokale Quittierung wieder auf:
  // neue Meldung → erneut zeigen; Switch aus → ohnehin weg.
  useEffect(() => {
    setAcked(false);
  }, [sw?.state, txt?.state, lvl?.state]);

  if (!alertSwitchEntity || !isAlertOn(sw?.state) || acked) return null;

  const { text, level } = resolveAlert(txt?.state, lvl?.state);

  const dismiss = () => {
    setAcked(true);
    const domain = alertSwitchEntity.split(".")[0] || "input_boolean";
    callService({ domain, service: "turn_off", entity_id: alertSwitchEntity }).catch(() =>
      setAcked(false),
    );
  };

  return (
    <div className="alert" role="alertdialog" aria-modal="true">
      <div className={`alert__body alert--${level}`}>
        <div className="alert__pulse">
          <div className="alert__icon">
            <AlertIcon level={level} />
          </div>
          <div className="alert__text">{text || FALLBACK[level]}</div>
        </div>
        <button type="button" className="alert__ok" onClick={dismiss}>
          OK
        </button>
      </div>
    </div>
  );
}
