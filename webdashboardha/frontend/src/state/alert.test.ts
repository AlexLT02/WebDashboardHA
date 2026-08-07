import { describe, expect, it } from "vitest";
import { isAlertOn, normalizeLevel, resolveAlert } from "./alert";

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
