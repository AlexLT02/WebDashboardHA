import { useEffect, useState } from "react";
import { fetchHostInfo } from "../state/dashboards";
import { Dialog } from "./Dialog";
import type { BoardSettings } from "../state/useBoard";

interface Props {
  settings: BoardSettings;
  onSetting: (key: keyof BoardSettings, value: boolean) => void;
  onClose: () => void;
}

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

      <div className="dlg__gap" />
      <button type="button" className="dlg__primary" onClick={() => window.location.reload()}>
        Seite neu laden
      </button>
    </Dialog>
  );
}
