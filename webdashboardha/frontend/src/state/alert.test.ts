import { describe, expect, it } from "vitest";
import {
  activeIndex,
  collectAlerts,
  isAlertOn,
  normalizeLevel,
  parseSlot,
  resolveAlert,
  topLevel,
} from "./alert";

describe("isAlertOn", () => {
  it("ist nur bei genau 'on' wahr", () => {
    expect(isAlertOn("on")).toBe(true);
    expect(isAlertOn("off")).toBe(false);
    expect(isAlertOn(undefined)).toBe(false);
    expect(isAlertOn("unavailable")).toBe(false);
    expect(isAlertOn("On")).toBe(false); // HA liefert Kleinschreibung
  });
});

describe("normalizeLevel", () => {
  it("erkennt die drei kanonischen Stufen", () => {
    expect(normalizeLevel("wichtig")).toBe("wichtig");
    expect(normalizeLevel("warnung")).toBe("warnung");
    expect(normalizeLevel("hinweis")).toBe("hinweis");
  });
  it("ist tolerant gegenüber Schreibweise/Sprache/Synonymen", () => {
    expect(normalizeLevel("Wichtig")).toBe("wichtig");
    expect(normalizeLevel(" CRITICAL ")).toBe("wichtig");
    expect(normalizeLevel("rot")).toBe("wichtig");
    expect(normalizeLevel("Info")).toBe("hinweis");
    expect(normalizeLevel("blau")).toBe("hinweis");
    expect(normalizeLevel("Warnung!")).toBe("warnung");
    expect(normalizeLevel("gelb")).toBe("warnung");
  });
  it("fällt bei Unbekanntem/Leerem auf die mittlere Stufe", () => {
    expect(normalizeLevel(undefined)).toBe("warnung");
    expect(normalizeLevel("")).toBe("warnung");
    expect(normalizeLevel("banane")).toBe("warnung");
  });
});

describe("resolveAlert", () => {
  it("übernimmt echten Text und trimmt", () => {
    expect(resolveAlert("  Kühlschrank offen ", "wichtig")).toEqual({
      text: "Kühlschrank offen",
      level: "wichtig",
    });
  });
  it("verwirft leere/Sentinel-Texte", () => {
    expect(resolveAlert("", "hinweis").text).toBe("");
    expect(resolveAlert("   ", "hinweis").text).toBe("");
    expect(resolveAlert("unavailable", "hinweis").text).toBe("");
    expect(resolveAlert("unknown", "hinweis").text).toBe("");
    expect(resolveAlert(undefined, "hinweis").text).toBe("");
  });
  it("liefert immer eine Stufe, auch ohne Level-Entität", () => {
    expect(resolveAlert("Text", undefined).level).toBe("warnung");
  });
});

describe("parseSlot", () => {
  it("zerlegt einen belegten Slot", () => {
    expect(parseSlot(2, "automation.kuehl|wichtig|Kühlschrank offen")).toEqual({
      slot: 2,
      id: "automation.kuehl",
      text: "Kühlschrank offen",
      level: "wichtig",
    });
  });
  it("behandelt leere und Sentinel-Slots als frei", () => {
    expect(parseSlot(1, "")).toBeNull();
    expect(parseSlot(1, "   ")).toBeNull();
    expect(parseSlot(1, "unknown")).toBeNull();
    expect(parseSlot(1, "unavailable")).toBeNull();
    expect(parseSlot(1, undefined)).toBeNull();
  });
  it("ignoriert Einträge ohne Warn-ID", () => {
    expect(parseSlot(1, "|warnung|Text ohne ID")).toBeNull();
  });
  it("verträgt Pipes im Meldungstext", () => {
    expect(parseSlot(1, "a.b|warnung|Links | Rechts")?.text).toBe("Links | Rechts");
  });
  it("fällt bei unbekannter Stufe auf warnung", () => {
    expect(parseSlot(1, "a.b|banane|Text")?.level).toBe("warnung");
  });
});

describe("collectAlerts", () => {
  it("sammelt nur belegte Slots, in Slot-Reihenfolge", () => {
    const alerts = collectAlerts(["", "a.b|hinweis|B", "unknown", "a.d|wichtig|D"]);
    expect(alerts.map((a) => [a.slot, a.text])).toEqual([
      [2, "B"],
      [4, "D"],
    ]);
  });
  it("liefert bei leerem Register eine leere Liste", () => {
    expect(collectAlerts(["", "", "", ""])).toEqual([]);
  });
});

describe("topLevel", () => {
  it("nimmt die dringlichste Stufe", () => {
    const alerts = collectAlerts(["a.a|hinweis|A", "a.b|wichtig|B", "a.c|warnung|C"]);
    expect(topLevel(alerts)).toBe("wichtig");
  });
  it("ohne Warnungen die niedrigste Stufe", () => {
    expect(topLevel([])).toBe("hinweis");
  });
});

describe("activeIndex", () => {
  const alerts = collectAlerts(["a.a|warnung|A", "", "a.c|warnung|C"]);

  it("findet die Position zur Slot-Nummer aus HA", () => {
    expect(activeIndex(alerts, "1.0")).toBe(0);
    expect(activeIndex(alerts, "3.0")).toBe(1);
  });
  it("fällt auf die erste Warnung zurück, wenn der Index ins Leere zeigt", () => {
    expect(activeIndex(alerts, "2.0")).toBe(0); // Slot 2 ist frei
    expect(activeIndex(alerts, undefined)).toBe(0);
    expect(activeIndex(alerts, "quatsch")).toBe(0);
  });
  it("meldet -1, wenn gar nichts aktiv ist", () => {
    expect(activeIndex([], "1.0")).toBe(-1);
  });
});
