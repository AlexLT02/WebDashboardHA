import { describe, expect, it } from "vitest";
import { isNight, parseTime, splitDuration, toSeconds } from "./night";

const at = (h: number, m = 0) => new Date(2026, 6, 31, h, m, 0);

describe("parseTime", () => {
  it("liest HH:MM", () => {
    expect(parseTime("22:00")).toBe(1320);
    expect(parseTime("06:30")).toBe(390);
    expect(parseTime("0:05")).toBe(5);
  });
  it("weist Unsinn ab", () => {
    expect(parseTime("")).toBeNull();
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("12:60")).toBeNull();
    expect(parseTime("abc")).toBeNull();
  });
});

describe("isNight", () => {
  it("erkennt ein Fenster über Mitternacht", () => {
    expect(isNight("22:00", "06:30", at(23))).toBe(true);
    expect(isNight("22:00", "06:30", at(3))).toBe(true);
    expect(isNight("22:00", "06:30", at(22, 0))).toBe(true); // Start inklusive
    expect(isNight("22:00", "06:30", at(6, 29))).toBe(true);
    expect(isNight("22:00", "06:30", at(6, 30))).toBe(false); // Ende exklusive
    expect(isNight("22:00", "06:30", at(12))).toBe(false);
    expect(isNight("22:00", "06:30", at(21, 59))).toBe(false);
  });
  it("erkennt ein Fenster innerhalb eines Tages", () => {
    expect(isNight("13:00", "15:00", at(14))).toBe(true);
    expect(isNight("13:00", "15:00", at(15))).toBe(false);
    expect(isNight("13:00", "15:00", at(2))).toBe(false);
  });
  it("gleiche Zeiten heißt kein Nachtmodus", () => {
    expect(isNight("22:00", "22:00", at(23))).toBe(false);
  });
  it("ungültige Zeiten schalten nicht ab", () => {
    expect(isNight("", "06:30", at(23))).toBe(false);
    expect(isNight("22:00", "99:99", at(23))).toBe(false);
  });
});

describe("splitDuration / toSeconds", () => {
  it("wählt die größte glatte Einheit", () => {
    expect(splitDuration(7200)).toEqual({ value: 2, unit: "h" });
    expect(splitDuration(900)).toEqual({ value: 15, unit: "min" });
    expect(splitDuration(45)).toEqual({ value: 45, unit: "s" });
    expect(splitDuration(3660)).toEqual({ value: 61, unit: "min" });
    expect(splitDuration(0)).toEqual({ value: 0, unit: "s" });
  });
  it("rechnet zurück in Sekunden", () => {
    expect(toSeconds(15, "min")).toBe(900);
    expect(toSeconds(2, "h")).toBe(7200);
    expect(toSeconds(30, "s")).toBe(30);
  });
  it("begrenzt auf 24 h und faengt Unsinn ab", () => {
    expect(toSeconds(48, "h")).toBe(86400);
    expect(toSeconds(-5, "min")).toBe(0);
    expect(toSeconds(NaN, "min")).toBe(0);
  });
  it("ist zueinander invers", () => {
    for (const seconds of [0, 30, 90, 900, 3600, 7200]) {
      const { value, unit } = splitDuration(seconds);
      expect(toSeconds(value, unit)).toBe(seconds);
    }
  });
});
