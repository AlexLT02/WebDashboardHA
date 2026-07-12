import { useState } from "react";
import { useEntity } from "../state/store";
import { callService } from "../state/service";
import { displayName } from "../state/display";
import { resolveIcon } from "../controls/icons";
import { Tile } from "./Tile";
import { MoreInfoDialog } from "./MoreInfoDialog";
import type { WidgetConfig } from "../state/dashboards";

export function LightCard({ config }: { config: WidgetConfig }) {
  const entity = useEntity(config.entity_id);
  const [open, setOpen] = useState(false);
  const name = displayName(config, entity);
  const Icon = resolveIcon(config.options?.icon as string, "light");
  const big = config.w >= 2 || config.h >= 2;

  if (!entity) {
    return <Tile icon={Icon} title={name} subtitle="nicht verfügbar" unavailable big={big} />;
  }

  const on = entity.state === "on";
  const attrs = entity.attributes;
  const brightness = typeof attrs.brightness === "number" ? attrs.brightness : 0;
  const pct = Math.round((brightness / 255) * 100);
  const rgb = Array.isArray(attrs.rgb_color) ? (attrs.rgb_color as number[]) : null;
  const accent = on && rgb ? `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` : undefined;

  const subtitle = on ? (brightness ? `Ein · ${pct}%` : "Ein") : "Aus";

  const toggle = () =>
    callService({
      domain: "light",
      service: on ? "turn_off" : "turn_on",
      entity_id: config.entity_id,
    }).catch(console.error);

  return (
    <>
      <Tile
        icon={Icon}
        title={name}
        subtitle={subtitle}
        active={on}
        accent={accent}
        big={big}
        onTap={toggle}
        onLongPress={() => setOpen(true)}
      />
      {open && (
        <MoreInfoDialog
          entityId={config.entity_id}
          title={name}
          config={config}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
