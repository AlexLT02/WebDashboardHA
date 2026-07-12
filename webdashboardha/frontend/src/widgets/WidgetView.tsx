import type { WidgetConfig } from "../state/dashboards";
import { LightCard } from "./LightCard";
import { SensorCard } from "./SensorCard";
import { SwitchCard } from "./SwitchCard";
import { ClockCard } from "./ClockCard";
import { CalendarCard } from "./CalendarCard";
import { WeatherCard } from "./WeatherCard";
import { MediaCard } from "./MediaCard";
import { Tile } from "./Tile";
import { GaugeIcon } from "../controls/icons";

/** Rendert die passende Karte für einen Widget-Typ (position-unabhängig). */
export function WidgetView({ config }: { config: WidgetConfig }) {
  switch (config.type) {
    case "light":
      return <LightCard config={config} />;
    case "switch":
      return <SwitchCard config={config} />;
    case "sensor":
      return <SensorCard config={config} />;
    case "clock":
      return <ClockCard config={config} />;
    case "calendar":
      return <CalendarCard config={config} />;
    case "weather":
      return <WeatherCard config={config} />;
    case "media":
      return <MediaCard config={config} />;
    default:
      return (
        <Tile
          icon={GaugeIcon}
          title={config.title ?? config.entity_id}
          subtitle={`Unbekannter Typ: ${config.type}`}
          unavailable
        />
      );
  }
}
