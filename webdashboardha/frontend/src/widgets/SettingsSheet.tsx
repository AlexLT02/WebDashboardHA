import { useState } from "react";
import { ICON_KEYS, ICONS } from "../controls/icons";
import { useUpdateWidget } from "../state/widgetContext";
import type { WidgetConfig } from "../state/dashboards";
import "./SettingsSheet.css";

/** Einstellungen pro Gerät: Alias-Name + Icon-Auswahl (manueller Override). */
export function SettingsSheet({ config }: { config: WidgetConfig }) {
  const update = useUpdateWidget();
  const [alias, setAlias] = useState((config.options?.alias as string) ?? "");
  const currentIcon = (config.options?.icon as string) ?? "";

  return (
    <div className="settings">
      <label className="settings__label">Alias-Name</label>
      <input
        className="settings__input"
        type="text"
        placeholder="eigener Name (optional)"
        value={alias}
        onChange={(e) => setAlias(e.target.value)}
        onBlur={() => update(config.id, { alias: alias.trim() })}
        onKeyDown={(e) => {
          if (e.key === "Enter") update(config.id, { alias: alias.trim() });
        }}
      />

      <label className="settings__label">Icon</label>
      <div className="settings__icons">
        <button
          type="button"
          className={`settings__icon${!currentIcon ? " is-active" : ""}`}
          onClick={() => update(config.id, { icon: "" })}
          title="Automatisch"
        >
          Auto
        </button>
        {ICON_KEYS.map((k) => {
          const Icon = ICONS[k];
          return (
            <button
              key={k}
              type="button"
              className={`settings__icon${currentIcon === k ? " is-active" : ""}`}
              onClick={() => update(config.id, { icon: k })}
              aria-label={k}
            >
              <Icon size={22} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
