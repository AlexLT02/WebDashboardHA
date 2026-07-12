import { useState } from "react";
import { useEntity } from "../state/store";
import { callService } from "../state/service";
import { displayName } from "../state/display";
import { resolveIcon } from "../controls/icons";
import { Tile } from "./Tile";
import { DeviceDialog } from "./DeviceDialog";
import type { WidgetConfig } from "../state/dashboards";

export function SwitchCard({ config }: { config: WidgetConfig }) {
  const entity = useEntity(config.entity_id);
  const [open, setOpen] = useState(false);
  const name = displayName(config, entity);
  const domain = config.entity_id.split(".")[0] || "switch";
  const Icon = resolveIcon(config.options?.icon as string, domain, entity?.attributes.device_class as string);
  const big = config.w >= 2 || config.h >= 2;

  if (!entity) {
    return <Tile icon={Icon} title={name} subtitle="nicht verfügbar" unavailable big={big} />;
  }

  const on = entity.state === "on";
  const toggle = () =>
    callService({
      domain,
      service: on ? "turn_off" : "turn_on",
      entity_id: config.entity_id,
    }).catch(console.error);

  return (
    <>
      <Tile
        icon={Icon}
        title={name}
        subtitle={on ? "Ein" : "Aus"}
        active={on}
        big={big}
        onTap={toggle}
        onLongPress={() => setOpen(true)}
      />
      {open && <DeviceDialog config={config} onClose={() => setOpen(false)} />}
    </>
  );
}
