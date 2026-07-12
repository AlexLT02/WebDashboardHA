import type { EntityState } from "./store";
import type { WidgetConfig } from "./dashboards";

/** Anzeigename: Alias (options.alias) vor Titel vor friendly_name vor entity_id. */
export function displayName(config: WidgetConfig, entity?: EntityState): string {
  const alias = config.options?.alias;
  if (typeof alias === "string" && alias.trim()) return alias;
  return (
    config.title ??
    (entity?.attributes.friendly_name as string) ??
    config.entity_id ??
    "Gerät"
  );
}

const BINARY_LABELS: Record<string, [string, string]> = {
  motion: ["Bewegung erkannt", "Keine Bewegung"],
  occupancy: ["Belegt", "Frei"],
  presence: ["Anwesend", "Abwesend"],
  door: ["Offen", "Geschlossen"],
  garage_door: ["Offen", "Geschlossen"],
  window: ["Offen", "Geschlossen"],
  opening: ["Offen", "Geschlossen"],
  moisture: ["Nass", "Trocken"],
  smoke: ["Rauch erkannt", "Kein Rauch"],
  gas: ["Gas erkannt", "Kein Gas"],
  lock: ["Entriegelt", "Verriegelt"],
  plug: ["Aktiv", "Inaktiv"],
  power: ["An", "Aus"],
  battery: ["Schwach", "OK"],
  connectivity: ["Verbunden", "Getrennt"],
  problem: ["Problem", "OK"],
  safety: ["Unsicher", "Sicher"],
  heat: ["Heiß", "Normal"],
  cold: ["Kalt", "Normal"],
  running: ["Läuft", "Gestoppt"],
  update: ["Update verfügbar", "Aktuell"],
};

/** Zustands-Text für Sensoren — device_class-korrekt (Tür offen/zu, Bewegung, …). */
export function sensorStateLabel(entity: EntityState): string {
  const domain = entity.entity_id.split(".")[0];
  const dc = entity.attributes.device_class as string | undefined;

  if (domain === "binary_sensor") {
    const on = entity.state === "on";
    const pair = dc ? BINARY_LABELS[dc] : undefined;
    if (pair) return on ? pair[0] : pair[1];
    return on ? "An" : "Aus";
  }

  // Numerischer/Text-Sensor: Wert + Einheit
  const unit = (entity.attributes.unit_of_measurement as string) ?? "";
  if (entity.state === "unavailable") return "nicht verfügbar";
  if (entity.state === "unknown") return "unbekannt";
  return `${entity.state} ${unit}`.trim();
}
