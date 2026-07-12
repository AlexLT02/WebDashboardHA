import { useState } from "react";
import { useEntity } from "../state/store";
import { callService } from "../state/service";
import { displayName, sensorStateLabel } from "../state/display";
import { Toggle } from "../controls/Toggle";
import { SettingsSheet } from "./SettingsSheet";
import type { WidgetConfig } from "../state/dashboards";
import "./MoreInfoDialog.css";

/** Detail-Dialog für Nicht-Licht-Geräte (Schalter, Sensor, …): Zustand,
 *  ggf. Schalten, und Einstellungen (Alias, Icon) übers Zahnrad. */
export function DeviceDialog({ config, onClose }: { config: WidgetConfig; onClose: () => void }) {
  const entity = useEntity(config.entity_id);
  const [settings, setSettings] = useState(false);
  const name = displayName(config, entity);
  const domain = config.entity_id.split(".")[0];
  const isSensor = domain === "sensor" || domain === "binary_sensor";
  const toggleable = ["switch", "input_boolean", "fan"].includes(domain);
  const on = entity?.state === "on";

  const stateText = !entity
    ? "nicht verfügbar"
    : isSensor
      ? sensorStateLabel(entity)
      : on
        ? "Ein"
        : "Aus";

  const toggle = () =>
    callService({
      domain,
      service: on ? "turn_off" : "turn_on",
      entity_id: config.entity_id,
    }).catch(console.error);

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__header">
          <button type="button" className="dialog__close" aria-label="Schließen" onClick={onClose}>
            ✕
          </button>
          <h2 className="dialog__title">{name}</h2>
          <button
            type="button"
            className="dialog__close"
            aria-label="Einstellungen"
            onClick={() => setSettings((s) => !s)}
          >
            ⚙
          </button>
        </div>

        <div className="dialog__state">{stateText}</div>

        {toggleable && (
          <Toggle on={on} onToggle={toggle} aria-label={`${name} schalten`} />
        )}

        {settings && <SettingsSheet config={config} />}
      </div>
    </div>
  );
}
