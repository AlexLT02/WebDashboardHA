import { describe, expect, it } from "vitest";
import {
  ACCENT_WARM,
  allCategories,
  bucketByCategory,
  categoryForDomain,
  categoryOf,
  customCategories,
  greeting,
  isControllable,
  isOn,
  withAlpha,
} from "./board";
import type { WidgetConfig } from "./dashboards";

function w(id: string, entity_id: string, options: Record<string, unknown> = {}): WidgetConfig {
  return { id, type: "x", entity_id, x: 0, y: 0, w: 1, h: 1, options };
}

describe("categoryForDomain", () => {
  it("mappt Domains auf Basiskategorien", () => {
    expect(categoryForDomain("light")).toBe("licht");
    expect(categoryForDomain("switch")).toBe("geraete");
    expect(categoryForDomain("input_boolean")).toBe("geraete");
    expect(categoryForDomain("fan")).toBe("luft");
    expect(categoryForDomain("cover")).toBe("rollo");
    expect(categoryForDomain("media_player")).toBe("medien");
    expect(categoryForDomain("sensor")).toBe("sensor");
    expect(categoryForDomain("binary_sensor")).toBe("sensor");
    expect(categoryForDomain("unknown")).toBe("geraete");
  });
});

describe("categoryOf", () => {
  it("nutzt die Domain, wenn kein Override gesetzt ist", () => {
    expect(categoryOf(w("1", "light.wz"))).toBe("licht");
    expect(categoryOf(w("2", "fan.bad"))).toBe("luft");
  });
  it("respektiert einen bekannten Override", () => {
    const known = new Set(["licht", "garten"]);
    expect(categoryOf(w("3", "light.aussen", { category: "garten" }), known)).toBe("garten");
  });
  it("fällt bei unbekanntem Override auf die Domain zurück", () => {
    const known = new Set(["licht"]);
    expect(categoryOf(w("4", "light.aussen", { category: "geloescht" }), known)).toBe("licht");
  });
});

describe("bucketByCategory", () => {
  const cats = allCategories(undefined);
  const widgets = [w("a", "light.a"), w("b", "switch.b"), w("c", "sensor.c")];

  it("gruppiert nach Kategorie und lässt leere aus", () => {
    const buckets = bucketByCategory(widgets, cats, false);
    const keys = buckets.map((b) => b.def.key);
    expect(keys).toEqual(["licht", "geraete", "sensor"]);
    expect(buckets[0].widgets.map((x) => x.id)).toEqual(["a"]);
  });

  it("zeigt im Edit-Modus auch leere Kategorien", () => {
    const buckets = bucketByCategory(widgets, cats, true);
    // Alle 6 Basiskategorien erscheinen.
    expect(buckets.length).toBe(6);
  });

  it("behält die Kategorie-Reihenfolge bei", () => {
    const buckets = bucketByCategory([w("m", "media_player.s"), w("l", "light.x")], cats, false);
    expect(buckets.map((b) => b.def.key)).toEqual(["licht", "medien"]);
  });
});

describe("customCategories / allCategories", () => {
  it("filtert kaputte Einträge", () => {
    const meta = { customCategories: [{ key: "g", name: "Garten", icon: "plant" }, null, {}] as never };
    expect(customCategories(meta as never)).toEqual([{ key: "g", name: "Garten", icon: "plant" }]);
  });
  it("hängt Custom-Kategorien hinten an", () => {
    const cats = allCategories({ customCategories: [{ key: "g", name: "Garten", icon: "plant" }] });
    expect(cats[cats.length - 1]).toMatchObject({ key: "g", name: "Garten", custom: true });
  });
});

describe("isOn / isControllable", () => {
  it("wertet Zustände domain-abhängig aus", () => {
    expect(isOn("light", "on")).toBe(true);
    expect(isOn("light", "off")).toBe(false);
    expect(isOn("cover", "open")).toBe(true);
    expect(isOn("cover", "closed")).toBe(false);
    expect(isOn("media_player", "playing")).toBe(true);
    expect(isOn("media_player", "paused")).toBe(false);
    expect(isOn("sensor", "on")).toBe(false);
    expect(isOn("light", undefined)).toBe(false);
  });
  it("Sensoren sind nicht steuerbar", () => {
    expect(isControllable("sensor")).toBe(false);
    expect(isControllable("binary_sensor")).toBe(false);
    expect(isControllable("light")).toBe(true);
  });
});

describe("withAlpha", () => {
  it("wandelt hex → rgba", () => {
    expect(withAlpha("#ef936b", 0.5)).toBe("rgba(239,147,107,0.5)");
  });
  it("wandelt kurzes hex → rgba", () => {
    expect(withAlpha("#fff", 1)).toBe("rgba(255,255,255,1)");
  });
  it("wandelt hsl → hsla", () => {
    expect(withAlpha("hsl(24,85%,60%)", 0.2)).toBe("hsla(24,85%,60%,0.2)");
  });
  it("lässt den Warm-Akzent-Hex zu", () => {
    expect(withAlpha(ACCENT_WARM, 1)).toBe("rgba(239,147,107,1)");
  });
});

describe("greeting", () => {
  it("wählt die Tageszeit", () => {
    const at = (h: number) => greeting(new Date(2026, 0, 1, h, 0, 0));
    expect(at(3)).toBe("Gute Nacht");
    expect(at(8)).toBe("Guten Morgen");
    expect(at(14)).toBe("Schönen Tag");
    expect(at(20)).toBe("Guten Abend");
    expect(at(23)).toBe("Gute Nacht");
  });
});
