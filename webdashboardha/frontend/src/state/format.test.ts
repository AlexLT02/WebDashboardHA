import { describe, expect, it } from "vitest";
import {
  briPct, dateLong, dayName, duration, hhmm, minutesSince, num, parseNum, pct, shortName, temp, watts,
  weatherIcon, weatherText,
} from "./format";

describe("numbers (04 §5.8)", () => {
  it("parses HA states", () => {
    expect(parseNum("21.4")).toBe(21.4);
    expect(parseNum(5)).toBe(5);
    expect(parseNum("unavailable")).toBeNull();
    expect(parseNum("")).toBeNull();
    expect(parseNum(undefined)).toBeNull();
  });
  it("uses a decimal comma", () => {
    expect(num(22.84, 1)).toBe("22,8");
    expect(num(-0.04, 1)).toBe("0,0");
    expect(temp(22.8)).toBe("22,8°");
    expect(temp(23)).toBe("23,0°");
    expect(temp(null)).toBe("–");
  });
  it("formats percent and watts", () => {
    expect(pct(64.4)).toBe("64 %");
    expect(watts(33.7)).toBe("34 W");
    expect(watts(5.3)).toBe("5 W");
  });
  it("never shows 0 % for a light that is on", () => {
    expect(briPct(1)).toBe(1);
    expect(briPct(163)).toBe(64);
    expect(briPct(255)).toBe(100);
  });
});

describe("time", () => {
  const t = new Date(2026, 10, 11, 7, 5).getTime();
  it("formats HH:MM and the date without Intl options", () => {
    expect(hhmm(t)).toBe("07:05");
    expect(dayName(t)).toBe("Mittwoch");
    expect(dateLong(t)).toBe("11. November");
  });
  it("counts minutes", () => {
    expect(minutesSince(t, t + 3 * 60000 + 59000)).toBe(3);
    expect(minutesSince(t + 1000, t)).toBe(0);
    expect(duration(42)).toBe("42 min");
    expect(duration(96)).toBe("1 h 36 min");
    expect(duration(120)).toBe("2 h");
  });
});

describe("weather", () => {
  it("maps HA conditions (04 §5.4)", () => {
    expect(weatherText("cloudy")).toBe("bewölkt");
    expect(weatherText("partlycloudy")).toBe("heiter");
    expect(weatherText("lightning-rainy")).toBe("Gewitter");
    expect(weatherText("pouring")).toBe("Starkregen");
    expect(weatherText("unknown-thing")).toBe("");
    expect(weatherIcon("clear-night")).toBe("moon");
    expect(weatherIcon("sunny")).toBe("sun");
    expect(weatherIcon("rainy")).toBe("cloud");
  });
});

describe("shortName", () => {
  it("keeps names up to 14 characters", () => {
    expect(shortName("Ambiente Sofa")).toBe("Ambiente Sofa");
    expect(shortName("  Lan-Switch ")).toBe("Lan-Switch");
  });
  it("cuts long HA names at a word boundary", () => {
    expect(shortName("Kleiderschrank Ambiente")).toBe("Kleiderschrank");
    expect(shortName("Licht Flur oben links")).toBe("Licht Flur…");
    expect(shortName("Donaudampfschifffahrt")).toBe("Donaudampfsch…");
    for (const n of ["Kleiderschrank Ambiente", "Licht Flur oben links", "Donaudampfschifffahrt"]) {
      expect(shortName(n).length).toBeLessThanOrEqual(14);
    }
  });
});
