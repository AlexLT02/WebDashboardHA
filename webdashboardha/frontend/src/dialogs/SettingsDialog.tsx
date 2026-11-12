import { useEffect, useState } from "react";
import { Dialog } from "./Dialog";
import { Icon } from "../controls/icons";
import { Press } from "../controls/Press";
import { fetchHostInfo } from "../state/api";
import { useSettings, useSettingsStore, type Settings } from "../state/useSettings";

/** "Nachts gedimmt einschalten" (D14): Aus · 10 · 15 · 25 %. */
const NIGHT_ON = [0, 10, 15, 25];

function Toggle({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <Press className={`dlg__switch${on ? " is-on" : ""}`} label={label} onPress={onToggle}>
      <span className="dlg__switch-knob" />
    </Press>
  );
}

function EntityField({ k, label, placeholder }: { k: keyof Settings; label: string; placeholder: string }) {
  const settings = useSettings();
  const set = useSettingsStore((s) => s.set);
  return (
    <div className="dlg__field">
      <div className="dlg__label">{label}</div>
      <input
        type="text"
        className="dlg__input"
        value={String(settings[k])}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => set(k, e.target.value.trim() as never)}
      />
    </div>
  );
}

/** Warning helpers, unchanged from 1.4.2, folded into a second view (no scrolling). */
function AlertHelpers({ onBack }: { onBack: () => void }) {
  return (
    <>
      <Press className="pbtn" label="Zurück" onPress={onBack}>
        <Icon name="left" />
        Zurück zu den Einstellungen
      </Press>
      <div className="dlg__hint">Entitäten, die die Warnmeldung steuern. Schalter an heißt anzeigen.</div>
      <div className="dlg__duo dlg__duo--fields">
        <EntityField k="alertSwitchEntity" label="Schalter" placeholder="input_boolean.dashboard_alert" />
        <EntityField k="alertTextEntity" label="Text" placeholder="input_text.dashboard_alert_text" />
        <EntityField k="alertLevelEntity" label="Dringlichkeit" placeholder="input_select.dashboard_alert_level" />
        <EntityField k="alertSlotPrefix" label="Register, Slot-Präfix" placeholder="input_text.wdh_slot_" />
        <EntityField k="alertIndexEntity" label="Index" placeholder="input_number.wdh_index" />
        <EntityField k="alertAckScript" label="Quittier-Skript" placeholder="script.wdh_ack" />
      </div>
    </>
  );
}

/**
 * Einstellungen (04 §5.7, shortened): night window, "Nachts gedimmt
 * einschalten", warning helpers (folded), address. Dark design, screen saver,
 * kiosk, strength and fade are gone (D13, D16). Fits without scrolling.
 */
export function SettingsDialog() {
  const settings = useSettings();
  const set = useSettingsStore((s) => s.set);
  const [kioskUrl, setKioskUrl] = useState<string | null>(null);
  const [helpers, setHelpers] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchHostInfo()
      .then((info) => alive && setKioskUrl(`http://${info.host || window.location.hostname}:${info.port}`))
      .catch(() => alive && setKioskUrl(`http://${window.location.hostname}:8099`));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Dialog name="Einstellungen" state={helpers ? "Warnmeldung, HA-Helfer" : undefined} idleMs={120000}>
      {helpers ? (
        <AlertHelpers onBack={() => setHelpers(false)} />
      ) : (
        <>
          <div className="dlg__gap" />
          <div className="dlg__setting">
            <div className="dlg__setting-t">Nachtfenster</div>
            <div className="dlg__setting-d">Anzeige in dieser Zeit abdunkeln</div>
            <Toggle on={settings.night} label="Nachtfenster" onToggle={() => set("night", !settings.night)} />
          </div>
          <div className="dlg__duo">
            <div>
              <div className="dlg__label">Beginnt</div>
              <input type="time" className="dlg__input" value={settings.nightStart} disabled={!settings.night} onChange={(e) => set("nightStart", e.target.value)} />
            </div>
            <div>
              <div className="dlg__label">Endet</div>
              <input type="time" className="dlg__input" value={settings.nightEnd} disabled={!settings.night} onChange={(e) => set("nightEnd", e.target.value)} />
            </div>
          </div>
          <div className="psub">
            Nachts gedimmt einschalten<span>Licht per Symbol im Nachtfenster</span>
          </div>
          <div className="qchips">
            {NIGHT_ON.map((p) => (
              <Press key={p} className={`qchip${settings.nightOnPct === p ? " is-sel" : ""}`} label={p ? `Nachts ${p} Prozent` : "Nachts nicht dimmen"} onPress={() => set("nightOnPct", p)}>
                {p ? `${p} %` : "Aus"}
              </Press>
            ))}
          </div>
          <Press className="pbtn" label="Warnmeldung, HA-Helfer" onPress={() => setHelpers(true)}>
            Warnmeldung, HA-Helfer
            <Icon name="chev" className="qicon" />
          </Press>
          <div className="psub">Adresse</div>
          <div className="dlg__row">
            <span className="dlg__row-k">Kiosk (iPad)</span>
            <span className="dlg__row-v">{kioskUrl || "…"}</span>
          </div>
          <div className="dlg__row">
            <span className="dlg__row-k">Diese Seite</span>
            <span className="dlg__row-v">{window.location.host}</span>
          </div>
        </>
      )}
    </Dialog>
  );
}
