import { useEntity } from "../state/store";
import { Tile } from "./Tile";
import { iconForType } from "../controls/icons";
import type { WidgetConfig } from "../state/dashboards";

export function SensorCard({ config }: { config: WidgetConfig }) {
  const entity = useEntity(config.entity_id);
  const title = config.title ?? (entity?.attributes.friendly_name as string) ?? config.entity_id;

  // Thermometer-Icon für Temperatur, sonst generisches Gauge.
  const isTemp =
    entity?.attributes.device_class === "temperature" ||
    (entity?.attributes.unit_of_measurement as string | undefined)?.includes("C");
  const Icon = iconForType(isTemp ? "sensor" : "gauge");

  if (!entity) {
    return <Tile icon={Icon} title={title} subtitle="nicht verfügbar" unavailable />;
  }

  const unit = (entity.attributes.unit_of_measurement as string | undefined) ?? "";
  return <Tile icon={Icon} title={title} subtitle={`${entity.state} ${unit}`.trim()} />;
}
