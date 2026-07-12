import { useState } from "react";
import { useEntity } from "../state/store";
import { displayName, sensorStateLabel } from "../state/display";
import { resolveIcon } from "../controls/icons";
import { Tile } from "./Tile";
import { DeviceDialog } from "./DeviceDialog";
import type { WidgetConfig } from "../state/dashboards";

export function SensorCard({ config }: { config: WidgetConfig }) {
  const entity = useEntity(config.entity_id);
  const [open, setOpen] = useState(false);
  const name = displayName(config, entity);
  const domain = config.entity_id.split(".")[0] || "sensor";
  const Icon = resolveIcon(
    config.options?.icon as string,
    domain,
    entity?.attributes.device_class as string,
    name,
  );
  const big = config.h >= 2;

  if (!entity) {
    return <Tile icon={Icon} title={name} subtitle="nicht verfügbar" unavailable big={big} gridH={config.h} />;
  }

  return (
    <>
      <Tile
        icon={Icon}
        title={name}
        subtitle={sensorStateLabel(entity)}
        big={big} gridH={config.h}
        onLongPress={() => setOpen(true)}
      />
      {open && <DeviceDialog config={config} onClose={() => setOpen(false)} />}
    </>
  );
}
