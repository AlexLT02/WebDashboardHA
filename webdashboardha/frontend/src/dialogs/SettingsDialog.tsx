import { useEffect, useState } from "react";
import { Dialog } from "./Dialog";
import { Icon } from "../controls/icons";
import { Press } from "../controls/Press";
import { fetchHostInfo } from "../state/api";
import { useSettings, useSettingsStore, type Settings, type SnowMode } from "../state/useSettings";
import { DragBar } from "../controls/DragBar";
import { accentFromHs, applyAccent, hsFromAccent, normalizeAccent } from "../state/accent";

/** "Nachts gedimmt einschalten" (D14): Aus · 10 · 15 · 25 %. */
const NIGHT_ON = [0, 10, 15, 25];

const SNOW: [SnowMode, string][] = [
  ["auto", "Auto"],
  ["on", "An"],
  ["off", "Aus"],
];

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

const near = (t: number, r: number | null) => r !== null && Math.abs(t - r) < 0.01;

/**
 * Free accent colour: hue and saturation sliders (no <input type=color> on
 * iOS 12). Dragging previews live on :root, release saves it.
 */
function AccentPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [h, s] = hsFromAccent(value);
  const [live, setLive] = useState<[number, number] | null>(null);
  const cur = live || [h, s];
  const hex = accentFromHs(cur[0], cur[1]);
  const preview = (next: [number, number] | null) => {
    setLive(next);
    applyAccent(next ? accentFromHs(next[0], next[1]) : normalizeAccent(value));
  };
  const satBg = `linear-gradient(90deg, ${accentFromHs(cur[0], 0)}, ${accentFromHs(cur[0], 1)})`;
  return (
    <>
      <div className="psub">
        Akzentfarbe<span className="dlg__swatch" style={{ background: hex }} />
      </div>
      <DragBar
        mode="pick"
        className="bar--hue"
        value={h}
        label="Akzentfarbe Farbton"
        throttleMs={0}
        timeoutMs={3000}
        confirm={near}
        onLocal={(v) => preview(v === null ? null : [v, cur[1]])}
        onCommit={(v) => onChange(accentFromHs(v, cur[1]))}
      />
      <DragBar
        mode="pick"
        className="bar--hue"
        style={{ background: satBg }}
        value={s}
        label="Akzentfarbe Sättigung"
        throttleMs={0}
        timeoutMs={3000}
        confirm={near}
        onLocal={(v) => preview(v === null ? null : [cur[0], v])}
        onCommit={(v) => onChange(accentFromHs(cur[0], v))}
      />
    </>
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
    <Dialog name="Einstellungen" state={helpers ? "Warnmeldung, HA-Helfer, Adresse" : undefined} idleMs={120000}>
      {helpers ? (
        <>
          <AlertHelpers onBack={() => setHelpers(false)} />
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
          <div className="psub">
            Schneefall<span>Auto: Dezember bis Februar</span>
          </div>
          <div className="qchips qchips--3">
            {SNOW.map(([mode, text]) => (
              <Press key={mode} className={`qchip${settings.snow === mode ? " is-sel" : ""}`} label={`Schneefall ${text}`} onPress={() => set("snow", mode)}>
                {text}
              </Press>
            ))}
          </div>
          <AccentPicker value={settings.accent} onChange={(hex) => set("accent", hex)} />
          <Press className="pbtn" label="Warnmeldung, HA-Helfer, Adresse" onPress={() => setHelpers(true)}>
            Warnmeldung, HA-Helfer, Adresse
            <Icon name="chev" className="qicon" />
          </Press>
        </>
      )}
    </Dialog>
  );
}
