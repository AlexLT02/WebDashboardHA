import { useEntity } from "../state/store";
import { callService } from "../state/service";
import { Tile } from "./Tile";
import { PowerIcon } from "../controls/icons";
import type { WidgetConfig } from "../state/dashboards";

export function SwitchCard({ config }: { config: WidgetConfig }) {
  const entity = useEntity(config.entity_id);
  const title = config.title ?? (entity?.attributes.friendly_name as string) ?? config.entity_id;

  if (!entity) {
    return <Tile icon={PowerIcon} title={title} subtitle="nicht verfügbar" unavailable />;
  }

  const on = entity.state === "on";
  const domain = config.entity_id.split(".")[0] || "switch";

  const toggle = () =>
    callService({
      domain,
      service: on ? "turn_off" : "turn_on",
      entity_id: config.entity_id,
    }).catch(console.error);

  return (
    <Tile
      icon={PowerIcon}
      title={title}
      subtitle={on ? "Ein" : "Aus"}
      active={on}
      onIconClick={toggle}
      onClick={toggle}
    />
  );
}
