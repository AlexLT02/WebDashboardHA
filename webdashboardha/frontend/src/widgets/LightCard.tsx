import { useState } from "react";
import { useEntity } from "../state/store";
import { callService } from "../state/service";
import { Tile } from "./Tile";
import { MoreInfoDialog } from "./MoreInfoDialog";
import { LightbulbIcon } from "../controls/icons";
import type { WidgetConfig } from "../state/dashboards";

export function LightCard({ config }: { config: WidgetConfig }) {
  const entity = useEntity(config.entity_id);
  const [open, setOpen] = useState(false);
  const title = config.title ?? (entity?.attributes.friendly_name as string) ?? config.entity_id;

  if (!entity) {
    return <Tile icon={LightbulbIcon} title={title} subtitle="nicht verfügbar" unavailable />;
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
        icon={LightbulbIcon}
        title={title}
        subtitle={subtitle}
        active={on}
        accent={accent}
        onTap={toggle}
        onLongPress={() => setOpen(true)}
      />
      {open && (
        <MoreInfoDialog entityId={config.entity_id} title={title} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
