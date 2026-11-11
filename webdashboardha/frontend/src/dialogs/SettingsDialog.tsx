import { useEffect, useState } from "react";
import { Dialog } from "./Dialog";
import { Press } from "../controls/Press";
import { DragBar } from "../controls/DragBar";
import { fetchHostInfo } from "../state/api";
import { DURATION_UNITS, splitDuration, toSeconds, type DurationUnit } from "../state/night";
import { useSettings, useSettingsStore, type Settings } from "../state/useSettings";

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
    <>
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
      <div className="dlg__gap--sm" />
    </>
  );
}

/**
 * Settings (existing dialog, shortened: dark design, screen saver and kiosk are
 * gone, D16). Night shade options stay until P6 replaces the shade (D13).
 */
export function SettingsDialog() {
  const settings = useSettings();
  const set = useSettingsStore((s) => s.set);
  const [kioskUrl, setKioskUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchHostInfo()
      .then((info) => alive && setKioskUrl(`http://${info.host || window.location.hostname}:${info.port}`))
      .catch(() => alive && setKioskUrl(`http://${window.location.hostname}:8099`));
    return () => {
      alive = false;
    };
  }, []);

  const fade = splitDuration(settings.nightFadeSec);

  return (
    <Dialog name="Einstellungen" idleMs={120000}>
      <div className="dlg__scroll">
        <div className="dlg__setting">
          <div className="dlg__setting-t">Nachtmodus</div>
          <div className="dlg__setting-d">Anzeige im Zeitfenster abdunkeln</div>
          <Toggle on={settings.night} label="Nachtmodus" onToggle={() => set("night", !settings.night)} />
        </div>
        {settings.night ? (
          <>
            <div className="dlg__duo">
              <div>
                <div className="dlg__label">Beginnt</div>
                <input type="time" className="dlg__input" value={settings.nightStart} onChange={(e) => set("nightStart", e.target.value)} />
              </div>
              <div>
                <div className="dlg__label">Endet</div>
                <input type="time" className="dlg__input" value={settings.nightEnd} onChange={(e) => set("nightEnd", e.target.value)} />
              </div>
            </div>
            <div className="dlg__gap" />
            <div className="dlg__label">{`Stärke, ${Math.round(settings.nightDim * 100)} % abgedunkelt`}</div>
            <DragBar
              mode="fill"
              value={settings.nightDim}
              throttleMs={0}
              timeoutMs={1000}
              confirm={(t, r) => r !== null && Math.abs(t - r) < 0.02}
              label="Stärke der Abdunklung"
              onCommit={(v) => set("nightDim", Math.round(v * 100) / 100)}
            />
            <div className="dlg__gap" />
            <div className="dlg__label">Übergang</div>
            <div className="dlg__duo">
              <input
                type="number"
                className="dlg__input"
                min={0}
                value={fade.value}
                onChange={(e) => set("nightFadeSec", toSeconds(Number(e.target.value), fade.unit))}
              />
              <select
                className="dlg__select"
                value={fade.unit}
                aria-label="Einheit des Übergangs"
                onChange={(e) => set("nightFadeSec", toSeconds(fade.value, e.target.value as DurationUnit))}
              >
                {DURATION_UNITS.map((u) => (
                  <option key={u.key} value={u.key}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="dlg__gap" />
          </>
        ) : null}

        <div className="dlg__label">Warnmeldung, HA-Helfer</div>
        <div className="dlg__hint">Entitäten, die die Warnmeldung steuern. Schalter an heißt anzeigen.</div>
        <div className="dlg__gap--sm" />
        <EntityField k="alertSwitchEntity" label="Schalter" placeholder="input_boolean.dashboard_alert" />
        <EntityField k="alertTextEntity" label="Text" placeholder="input_text.dashboard_alert_text" />
        <EntityField k="alertLevelEntity" label="Dringlichkeit" placeholder="input_select.dashboard_alert_level" />
        <EntityField k="alertSlotPrefix" label="Register, Slot-Präfix" placeholder="input_text.wdh_slot_" />
        <EntityField k="alertIndexEntity" label="Index" placeholder="input_number.wdh_index" />
        <EntityField k="alertAckScript" label="Quittier-Skript" placeholder="script.wdh_ack" />

        <div className="dlg__label">Adresse</div>
        <div className="dlg__row">
          <span className="dlg__row-k">Kiosk (iPad)</span>
          <span className="dlg__row-v">{kioskUrl || "…"}</span>
        </div>
        <div className="dlg__row">
          <span className="dlg__row-k">Diese Seite</span>
          <span className="dlg__row-v">{window.location.host}</span>
        </div>
      </div>
    </Dialog>
  );
}
