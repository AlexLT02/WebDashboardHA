import { useEffect, useState } from "react";
import { fetchHostInfo } from "../state/dashboards";
import { DURATION_UNITS, splitDuration, toSeconds, type DurationUnit } from "../state/night";
import { DragBar } from "../controls/DragBar";
import { Dialog } from "./Dialog";
import type { BoardSettings } from "../state/useBoard";

interface Props {
  settings: BoardSettings;
  onSetting: <K extends keyof BoardSettings>(key: K, value: BoardSettings[K]) => void;
  onClose: () => void;
}

const DIM_GRADIENT = "linear-gradient(90deg,rgba(110,168,254,0.35),#0b0d12)";

function Switch({
  on,
  onToggle,
  disabled,
  label,
}: {
  on: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`dlg__switch${on ? " is-on" : ""}`}
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      style={disabled ? { opacity: 0.7, cursor: "default" } : undefined}
      onClick={onToggle}
    >
      <span className="dlg__switch-knob" />
    </button>
  );
}

export function SettingsDialog({ settings, onSetting, onClose }: Props) {
  // Kiosk-Adresse: die echte Host-IP kennt nur der Supervisor. Klappt das nicht
  // (Dev-Modus), tut es der Hostname der aktuellen Seite genauso gut.
  const [kioskUrl, setKioskUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchHostInfo()
      .then((info) => {
        if (!alive) return;
        setKioskUrl(`http://${info.host ?? window.location.hostname}:${info.port}`);
      })
      .catch(() => {
        if (alive) setKioskUrl(`http://${window.location.hostname}:8099`);
      });
    return () => {
      alive = false;
    };
  }, []);

  const fade = splitDuration(settings.nightFadeSec);
  const dimPercent = Math.round(settings.nightDim * 100);

  return (
    <Dialog title="Einstellungen" onClose={onClose}>
      <div className="dlg__setting">
        <div>
          <div className="dlg__setting-t">Dunkles Design</div>
          <div className="dlg__setting-d">Für das Wand-iPad dauerhaft aktiv</div>
        </div>
        <Switch on disabled label="Dunkles Design" />
      </div>

      <div className="dlg__setting">
        <div>
          <div className="dlg__setting-t">Bildschirmschoner (Uhr)</div>
          <div className="dlg__setting-d">Nach 1 Min Inaktivität große Uhr zeigen</div>
        </div>
        <Switch
          on={settings.screensaver}
          label="Bildschirmschoner"
          onToggle={() => onSetting("screensaver", !settings.screensaver)}
        />
      </div>

      <div className="dlg__setting">
        <div>
          <div className="dlg__setting-t">Kiosk / Vollbild</div>
          <div className="dlg__setting-d">Vollbild anfordern (sofern unterstützt)</div>
        </div>
        <Switch
          on={settings.kiosk}
          label="Kiosk"
          onToggle={() => onSetting("kiosk", !settings.kiosk)}
        />
      </div>

      <div className="dlg__setting">
        <div>
          <div className="dlg__setting-t">Nachtmodus</div>
          <div className="dlg__setting-d">Anzeige im Zeitfenster abdunkeln</div>
        </div>
        <Switch
          on={settings.night}
          label="Nachtmodus"
          onToggle={() => onSetting("night", !settings.night)}
        />
      </div>

      {settings.night && (
        <>
          <div className="dlg__gap--sm" />
          <div className="dlg__duo">
            <div>
              <div className="dlg__label">Beginnt</div>
              <input
                type="time"
                className="dlg__input"
                value={settings.nightStart}
                onChange={(e) => onSetting("nightStart", e.target.value)}
              />
            </div>
            <div>
              <div className="dlg__label">Endet</div>
              <input
                type="time"
                className="dlg__input"
                value={settings.nightEnd}
                onChange={(e) => onSetting("nightEnd", e.target.value)}
              />
            </div>
          </div>
          <div className="dlg__gap" />

          <div className="dlg__label">Stärke · {dimPercent}% abgedunkelt</div>
          <DragBar
            mode="fill"
            gradient={DIM_GRADIENT}
            value={settings.nightDim}
            aria-label="Stärke der Abdunklung"
            onChange={(v) => onSetting("nightDim", Math.round(v * 100) / 100)}
          />
          <div className="dlg__gap" />

          <div className="dlg__label">Übergang</div>
          <div className="dlg__duo">
            <input
              type="number"
              className="dlg__input"
              min={0}
              value={fade.value}
              onChange={(e) => onSetting("nightFadeSec", toSeconds(Number(e.target.value), fade.unit))}
            />
            <select
              className="dlg__select"
              value={fade.unit}
              aria-label="Einheit des Übergangs"
              onChange={(e) =>
                onSetting("nightFadeSec", toSeconds(fade.value, e.target.value as DurationUnit))
              }
            >
              {DURATION_UNITS.map((u) => (
                <option key={u.key} value={u.key}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <div className="dlg__hint">
            So lange dauert das Ab- und wieder Aufblenden an den Grenzen des Fensters.
          </div>
        </>
      )}

      <div className="dlg__gap" />
      <div className="dlg__label">Warnmeldung — HA-Helfer</div>
      <div className="dlg__hint">
        Entitäten, die das Vollbild-Overlay steuern. Switch an = anzeigen.
      </div>
      <div className="dlg__gap--sm" />
      <div className="dlg__label">Switch (an = anzeigen)</div>
      <input
        type="text"
        className="dlg__input"
        value={settings.alertSwitchEntity}
        placeholder="input_boolean.dashboard_alert"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => onSetting("alertSwitchEntity", e.target.value.trim())}
      />
      <div className="dlg__gap--sm" />
      <div className="dlg__label">Text</div>
      <input
        type="text"
        className="dlg__input"
        value={settings.alertTextEntity}
        placeholder="input_text.dashboard_alert_text"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => onSetting("alertTextEntity", e.target.value.trim())}
      />
      <div className="dlg__gap--sm" />
      <div className="dlg__label">Dringlichkeit</div>
      <input
        type="text"
        className="dlg__input"
        value={settings.alertLevelEntity}
        placeholder="input_select.dashboard_alert_level"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => onSetting("alertLevelEntity", e.target.value.trim())}
      />
      <div className="dlg__hint">Stufen: wichtig (rot) · warnung (gelb) · hinweis (hellblau).</div>

      <div className="dlg__gap" />
      <div className="dlg__label">Adresse</div>
      <div className="dlg__row">
        <span className="dlg__row-k">Kiosk (iPad)</span>
        <span className="dlg__row-v dlg__row-v--pick">{kioskUrl ?? "…"}</span>
      </div>
      <div className="dlg__row">
        <span className="dlg__row-k">Diese Seite</span>
        <span className="dlg__row-v dlg__row-v--pick">{window.location.host}</span>
      </div>
    </Dialog>
  );
}
