import { useEntity } from "../state/store";
import type { WidgetConfig } from "../state/dashboards";
import "./panels.css";

const COND: Record<string, { icon: string; label: string }> = {
  "clear-night": { icon: "🌙", label: "Klar" },
  cloudy: { icon: "☁️", label: "Bewölkt" },
  fog: { icon: "🌫️", label: "Nebel" },
  hail: { icon: "🌨️", label: "Hagel" },
  lightning: { icon: "🌩️", label: "Gewitter" },
  "lightning-rainy": { icon: "⛈️", label: "Gewitterregen" },
  partlycloudy: { icon: "⛅", label: "Teilw. bewölkt" },
  pouring: { icon: "🌧️", label: "Starkregen" },
  rainy: { icon: "🌧️", label: "Regen" },
  snowy: { icon: "🌨️", label: "Schnee" },
  "snowy-rainy": { icon: "🌨️", label: "Schneeregen" },
  sunny: { icon: "☀️", label: "Sonnig" },
  windy: { icon: "💨", label: "Windig" },
  "windy-variant": { icon: "💨", label: "Windig" },
  exceptional: { icon: "⚠️", label: "Achtung" },
};

export function WeatherCard({ config }: { config: WidgetConfig }) {
  const entity = useEntity(config.entity_id);
  const title = config.title ?? (entity?.attributes.friendly_name as string) ?? "Wetter";
  const big = config.w >= 2 || config.h >= 2;

  if (!entity) {
    return (
      <div className="panel">
        <div className="weather__title">{title}</div>
        <div className="weather__cond">nicht verfügbar</div>
      </div>
    );
  }

  const c = COND[entity.state] ?? { icon: "🌡️", label: entity.state };
  const temp = entity.attributes.temperature;
  const unit = (entity.attributes.temperature_unit as string) ?? "°";
  const humidity = entity.attributes.humidity;
  const wind = entity.attributes.wind_speed;

  return (
    <div className="panel">
      {big && <div className="weather__title">{title}</div>}
      <div className="weather__row">
        <span className="weather__icon">{c.icon}</span>
        <div>
          <div className="weather__temp">
            {typeof temp === "number" ? `${Math.round(temp)}${unit}` : "–"}
          </div>
          <div className="weather__cond">{c.label}</div>
        </div>
      </div>
      {big && (
        <div className="weather__cond" style={{ marginTop: 8 }}>
          {typeof humidity === "number" ? `💧 ${humidity}%  ` : ""}
          {typeof wind === "number" ? `💨 ${Math.round(wind)}` : ""}
        </div>
      )}
    </div>
  );
}
