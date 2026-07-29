import { describe, expect, it } from "vitest";
import {
  coverActionVerb,
  coverFeatures,
  coverIsOpen,
  coverMoving,
  coverPosition,
  coverStateLabel,
  coverTapService,
} from "./cover";

// OPEN|CLOSE|SET_POSITION|STOP = 1|2|4|8
const FULL = 15;
const OPEN_CLOSE_ONLY = 3;

describe("coverFeatures", () => {
  it("liest die Bitmaske", () => {
    expect(coverFeatures({ supported_features: FULL })).toEqual({
      open: true,
      close: true,
      stop: true,
      setPosition: true,
    });
    expect(coverFeatures({ supported_features: OPEN_CLOSE_ONLY })).toEqual({
      open: true,
      close: true,
      stop: false,
      setPosition: false,
    });
  });
  it("bietet ohne gemeldete Features Auf/Zu/Stopp an, aber keine Position", () => {
    expect(coverFeatures({})).toEqual({
      open: true,
      close: true,
      stop: true,
      setPosition: false,
    });
    expect(coverFeatures({ supported_features: "15" })).toEqual({
      open: true,
      close: true,
      stop: true,
      setPosition: false,
    });
  });
  it("stoppt eine Fahrt auch bei ungemeldeten Features", () => {
    expect(coverTapService("closing", null, coverFeatures({}))).toBe("stop_cover");
  });
});

describe("coverPosition", () => {
  it("liest und begrenzt die Position", () => {
    expect(coverPosition({ current_position: 60 })).toBe(60);
    expect(coverPosition({ current_position: 60.4 })).toBe(60);
    expect(coverPosition({ current_position: -5 })).toBe(0);
    expect(coverPosition({ current_position: 140 })).toBe(100);
  });
  it("liefert null ohne Positionsangabe", () => {
    expect(coverPosition({})).toBeNull();
    expect(coverPosition({ current_position: "60" })).toBeNull();
  });
});

describe("coverIsOpen / coverMoving", () => {
  it("bevorzugt die Position vor dem Zustand", () => {
    expect(coverIsOpen("open", 0)).toBe(false);
    expect(coverIsOpen("closed", 30)).toBe(true);
  });
  it("fällt ohne Position auf den Zustand zurück", () => {
    expect(coverIsOpen("open", null)).toBe(true);
    expect(coverIsOpen("opening", null)).toBe(true);
    expect(coverIsOpen("closed", null)).toBe(false);
    expect(coverIsOpen(undefined, null)).toBe(false);
  });
  it("erkennt Fahrt", () => {
    expect(coverMoving("opening")).toBe(true);
    expect(coverMoving("closing")).toBe(true);
    expect(coverMoving("open")).toBe(false);
  });
});

describe("coverStateLabel", () => {
  it("zeigt die Position bei teiloffenen Rollläden", () => {
    expect(coverStateLabel("open", 60)).toBe("Offen · 60%");
    expect(coverStateLabel("open", 100)).toBe("Offen");
    expect(coverStateLabel("closed", 0)).toBe("Geschlossen");
  });
  it("zeigt die Fahrtrichtung", () => {
    expect(coverStateLabel("opening", 40)).toBe("Öffnet… · 40%");
    expect(coverStateLabel("closing", null)).toBe("Schließt…");
  });
  it("kommt ohne Position aus", () => {
    expect(coverStateLabel("open", null)).toBe("Offen");
    expect(coverStateLabel("closed", null)).toBe("Geschlossen");
  });
  it("markiert nicht verfügbare Rollläden", () => {
    expect(coverStateLabel("unavailable", null)).toBe("nicht verfügbar");
    expect(coverStateLabel(undefined, null)).toBe("nicht verfügbar");
  });
});

describe("coverTapService", () => {
  const full = coverFeatures({ supported_features: FULL });
  const noStop = coverFeatures({ supported_features: OPEN_CLOSE_ONLY });

  it("stoppt eine laufende Fahrt", () => {
    expect(coverTapService("opening", 40, full)).toBe("stop_cover");
    expect(coverTapService("closing", 40, full)).toBe("stop_cover");
  });
  it("schaltet um, wenn Stopp fehlt", () => {
    expect(coverTapService("opening", 40, noStop)).toBe("close_cover");
  });
  it("schaltet im Ruhezustand um", () => {
    expect(coverTapService("open", 100, full)).toBe("close_cover");
    expect(coverTapService("closed", 0, full)).toBe("open_cover");
  });
  it("liefert passende Log-Verben", () => {
    expect(coverActionVerb("stop_cover")).toBe("gestoppt");
    expect(coverActionVerb("open_cover")).toBe("geöffnet");
    expect(coverActionVerb("close_cover")).toBe("geschlossen");
  });
});
