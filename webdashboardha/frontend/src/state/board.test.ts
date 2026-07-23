import { describe, expect, it } from "vitest";
import {
  ACCENT_WARM,
  allCategories,
  bucketByCategory,
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

describe("categoryOf", () => {
  it("nutzt ohne Override die Sammelkategorie", () => {
    expect(categoryOf(w("1", "light.wz"))).toBe("uncategorized");
    expect(categoryOf(w("2", "fan.bad"))).toBe("uncategorized");
  });
  it("respektiert einen bekannten Override", () => {
    const known = new Set(["kueche", "uncategorized"]);
    expect(categoryOf(w("3", "light.aussen", { category: "kueche" }), known)).toBe("kueche");
  });
  it("fällt bei unbekanntem Override auf die Sammelkategorie zurück", () => {
    const known = new Set(["uncategorized"]);
    expect(categoryOf(w("4", "light.aussen", { category: "geloescht" }), known)).toBe(
      "uncategorized",
    );
  });
});

describe("bucketByCategory", () => {
  const cats = allCategories({ customCategories: [{ key: "kueche", name: "Küche", icon: "light" }] });
  const widgets = [
    w("a", "light.a", { category: "kueche" }),
    w("b", "switch.b"), // ohne Kategorie → uncategorized
    w("c", "light.c", { category: "geloescht" }), // unbekannt → uncategorized
  ];

  it("gruppiert nach Kategorie und lässt leere aus", () => {
    const buckets = bucketByCategory(widgets, cats, false);
    expect(buckets.map((b) => b.def.key)).toEqual(["kueche", "uncategorized"]);
    expect(buckets[0].widgets.map((x) => x.id)).toEqual(["a"]);
    expect(buckets[1].widgets.map((x) => x.id)).toEqual(["b", "c"]);
  });

  it("zeigt im Edit-Modus auch leere Kategorien", () => {
    const buckets = bucketByCategory([], cats, true);
    // Custom-Kategorie + Sammelkategorie, beide leer.
    expect(buckets.map((b) => b.def.key)).toEqual(["kueche", "uncategorized"]);
  });

  it("behält die Kategorie-Reihenfolge bei (Custom vor Sammelkategorie)", () => {
    const buckets = bucketByCategory([w("x", "switch.x")], cats, false);
    // Nur uncategorized hat Geräte; leere Custom-Kategorie fällt weg.
    expect(buckets.map((b) => b.def.key)).toEqual(["uncategorized"]);
  });
});

describe("customCategories / allCategories", () => {
  it("filtert kaputte Einträge", () => {
    const meta = { customCategories: [{ key: "g", name: "Garten", icon: "plant" }, null, {}] as never };
    expect(customCategories(meta as never)).toEqual([{ key: "g", name: "Garten", icon: "plant" }]);
  });
  it("stellt Custom-Kategorien vor die Sammelkategorie", () => {
    const cats = allCategories({ customCategories: [{ key: "g", name: "Garten", icon: "plant" }] });
    expect(cats[0]).toMatchObject({ key: "g", name: "Garten", custom: true });
    expect(cats[cats.length - 1].key).toBe("uncategorized");
  });
  it("ohne Custom-Kategorien nur die Sammelkategorie", () => {
    expect(allCategories(undefined).map((c) => c.key)).toEqual(["uncategorized"]);
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
