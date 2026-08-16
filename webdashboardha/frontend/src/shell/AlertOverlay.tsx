import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useEntity } from "../state/store";
import { callService } from "../state/service";
import {
  activeIndex,
  collectAlerts,
  isAlertOn,
  resolveAlert,
  type ActiveAlert,
  type AlertLevel,
} from "../state/alert";
import type { BoardSettings } from "../state/useBoard";

interface Props {
  settings: BoardSettings;
}

/** Ersatztext, falls kein Meldungstext hinterlegt ist — je Stufe. */
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
 * Zwei Betriebsarten, automatisch erkannt:
 *
 * 1. **Register** (`input_text.wdh_slot_1..4`): mehrere Warnungen gleichzeitig.
 *    Alle Texte stehen als Laufschrift nebeneinander; welcher gerade "dran" ist,
 *    bestimmt ausschließlich HA über `input_number.wdh_index`. Das ist Absicht:
 *    dieselbe Zahl steuert drüben die Geräte-Aktion, nur so passen Licht und
 *    Text zusammen — und zwei iPads zeigen dasselbe.
 * 2. **Fallback** (alte drei Helfer): genau eine Meldung, unverändertes Verhalten.
 *
 * Sichtbar ist das Overlay in beiden Fällen genau dann, wenn der `input_boolean`
 * an ist. Der OK-Button quittiert im Register-Betrieb nur die *angezeigte*
 * Warnung (die übrigen laufen weiter), im Fallback schaltet er den Switch aus.
 */
export function AlertOverlay({ settings }: Props) {
  const {
    alertSwitchEntity,
    alertTextEntity,
    alertLevelEntity,
    alertSlotPrefix,
    alertIndexEntity,
    alertAckScript,
  } = settings;

  const sw = useEntity(alertSwitchEntity);
  const txt = useEntity(alertTextEntity);
  const lvl = useEntity(alertLevelEntity);

  // Feste Anzahl Hooks (Hook-Reihenfolge muss über Renders stabil bleiben).
  // Leeres Präfix -> leere Entity-ID -> undefined, also Register aus.
  const p = alertSlotPrefix;
  const slot1 = useEntity(p ? p + "1" : "");
  const slot2 = useEntity(p ? p + "2" : "");
  const slot3 = useEntity(p ? p + "3" : "");
  const slot4 = useEntity(p ? p + "4" : "");
  const indexEnt = useEntity(alertIndexEntity);

  const [acked, setAcked] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const segRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [shift, setShift] = useState(0);

  const registerAlerts = collectAlerts([slot1?.state, slot2?.state, slot3?.state, slot4?.state]);
  const useRegister = registerAlerts.length > 0;

  const legacy = resolveAlert(txt?.state, lvl?.state);
  const alerts: ActiveAlert[] = useRegister
    ? registerAlerts
    : [{ slot: 1, id: "legacy", text: legacy.text, level: legacy.level }];
  const active = useRegister ? activeIndex(registerAlerts, indexEnt?.state) : 0;
  const current = alerts[active] ?? alerts[0];

  // Jede echte Zustandsänderung aus HA hebt die lokale Quittierung wieder auf:
  // neue Meldung → erneut zeigen; Switch aus → ohnehin weg.
  const fingerprint = [
    sw?.state,
    txt?.state,
    lvl?.state,
    slot1?.state,
    slot2?.state,
    slot3?.state,
    slot4?.state,
  ].join("");
  useEffect(() => {
    setAcked(false);
  }, [fingerprint]);

  // Laufschrift: die aktive Meldung mittig schieben. Bewusst gemessen statt per
  // CSS-Animation — so bleibt die Position an HAs Index gekoppelt und läuft
  // nicht mit der Zeit davon.
  const visible = Boolean(alertSwitchEntity) && isAlertOn(sw?.state) && !acked;
  useLayoutEffect(() => {
    if (!visible) return;
    const seg = segRefs.current[active];
    const viewport = viewportRef.current;
    if (!seg || !viewport) return;
    setShift(viewport.clientWidth / 2 - (seg.offsetLeft + seg.offsetWidth / 2));
  }, [visible, active, alerts.length, fingerprint]);

  if (!visible) return null;

  const level = current.level;
  const dismiss = () => {
    // Optimistisch nur ausblenden, wenn danach ohnehin nichts mehr übrig ist —
    // sonst würde das Overlay kurz verschwinden und sofort wiederkommen.
    if (alerts.length <= 1) setAcked(true);

    const undo = () => setAcked(false);
    if (useRegister && alertAckScript) {
      const [domain, service] = alertAckScript.split(".");
      callService({ domain: domain || "script", service: service || "wdh_ack" }).catch(undo);
      return;
    }
    const domain = alertSwitchEntity.split(".")[0] || "input_boolean";
    callService({ domain, service: "turn_off", entity_id: alertSwitchEntity }).catch(undo);
  };

  return (
    <div className="alert" role="alertdialog" aria-modal="true">
      <div className={`alert__body alert--${level}`}>
        <div className="alert__pulse">
          <div className="alert__icon">
            <AlertIcon level={level} />
          </div>
          <div className="alert__marquee" ref={viewportRef}>
            <div
              className="alert__track"
              ref={trackRef}
              style={{ transform: `translateX(${shift}px)` }}
            >
              {alerts.map((a, i) => (
                <span
                  key={a.slot + "-" + a.id}
                  ref={(el) => {
                    segRefs.current[i] = el;
                  }}
                  className={`alert__seg alert__seg--${a.level}${
                    i === active ? " is-current" : ""
                  }`}
                >
                  {a.text || FALLBACK[a.level]}
                </span>
              ))}
            </div>
          </div>
        </div>
        {alerts.length > 1 && (
          <div className="alert__dots" aria-hidden="true">
            {alerts.map((a, i) => (
              <span
                key={a.slot + "-" + a.id}
                className={`alert__dot${i === active ? " is-current" : ""}`}
              />
            ))}
          </div>
        )}
        <button type="button" className="alert__ok" onClick={dismiss}>
          {alerts.length > 1 ? "OK · diese" : "OK"}
        </button>
      </div>
    </div>
  );
}
