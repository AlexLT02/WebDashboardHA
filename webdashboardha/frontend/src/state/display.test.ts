import { describe, expect, it } from "vitest";
import { formatTemperature } from "./display";
import type { EntityState } from "./store";

function sensor(state: string, unit?: string): EntityState {
  return {
    entity_id: "sensor.t",
    state,
    attributes: unit === undefined ? {} : { unit_of_measurement: unit },
  };
}

describe("formatTemperature", () => {
  it("formatiert mit einer Nachkommastelle und Komma", () => {
    expect(formatTemperature(sensor("21.4", "°C"))).toBe("21,4 °C");
    expect(formatTemperature(sensor("21", "°C"))).toBe("21,0 °C");
    expect(formatTemperature(sensor("-3.25", "°C"))).toBe("-3,3 °C");
  });
  it("nimmt °C an, wenn HA keine Einheit liefert", () => {
    expect(formatTemperature(sensor("19.8"))).toBe("19,8 °C");
  });
  it("behält eine abweichende Einheit", () => {
    expect(formatTemperature(sensor("70.2", "°F"))).toBe("70,2 °F");
  });
  it("liefert null ohne verwertbaren Wert", () => {
    expect(formatTemperature(undefined)).toBeNull();
    expect(formatTemperature(sensor("unavailable", "°C"))).toBeNull();
    expect(formatTemperature(sensor("unknown", "°C"))).toBeNull();
    expect(formatTemperature(sensor("", "°C"))).toBeNull();
  });
});
