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
    </Dialog>
  );
}
