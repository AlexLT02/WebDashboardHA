import { describe, expect, it } from "vitest";
import { firstFreeCell, moveGroup, placeWidget, rowCount } from "./grid";
import type { Group, WidgetConfig } from "./dashboards";

function w(id: string, x: number, y: number): WidgetConfig {
  return { id, type: "light", entity_id: `light.${id}`, x, y, w: 1, h: 1, options: {} };
}

function g(id: string, columns: number, widgets: WidgetConfig[]): Group {
  return { id, name: "", columns, widgets };
}

describe("firstFreeCell", () => {
  it("findet die erste freie Zelle zeilenweise", () => {
    const group = g("g1", 3, [w("a", 0, 0), w("b", 1, 0)]);
    expect(firstFreeCell(group)).toEqual({ x: 2, y: 0 });
  });

  it("springt in die nächste Zeile, wenn die erste voll ist", () => {
    const group = g("g1", 2, [w("a", 0, 0), w("b", 1, 0)]);
    expect(firstFreeCell(group)).toEqual({ x: 0, y: 1 });
  });

  it("überspringt Lücken korrekt", () => {
    const group = g("g1", 3, [w("a", 0, 0), w("b", 2, 0)]);
    expect(firstFreeCell(group)).toEqual({ x: 1, y: 0 });
  });
});

describe("placeWidget — leere Zielzelle", () => {
  it("verschiebt ein Widget auf eine freie Zelle derselben Gruppe", () => {
    const groups = [g("g1", 4, [w("a", 0, 0), w("b", 1, 0)])];
    const res = placeWidget(groups, "a", "g1", 3, 2);
    const a = res[0].widgets.find((x) => x.id === "a")!;
    expect(a).toMatchObject({ x: 3, y: 2 });
    expect(res[0].widgets.find((x) => x.id === "b")).toMatchObject({ x: 1, y: 0 });
  });
});

describe("placeWidget — Tausch in derselben Gruppe", () => {
  it("tauscht die Plätze, wenn die Zielzelle belegt ist", () => {
    const groups = [g("g1", 4, [w("a", 0, 0), w("b", 2, 1)])];
    const res = placeWidget(groups, "a", "g1", 2, 1);
    const a = res[0].widgets.find((x) => x.id === "a")!;
    const b = res[0].widgets.find((x) => x.id === "b")!;
    expect(a).toMatchObject({ x: 2, y: 1 });
    expect(b).toMatchObject({ x: 0, y: 0 }); // b bekommt a's alte Zelle
  });
});

describe("placeWidget — zwischen Gruppen", () => {
  it("verschiebt ein Widget in eine andere Gruppe (leere Zelle)", () => {
    const groups = [g("g1", 4, [w("a", 0, 0)]), g("g2", 4, [])];
    const res = placeWidget(groups, "a", "g2", 1, 0);
    expect(res[0].widgets).toHaveLength(0);
    expect(res[1].widgets).toHaveLength(1);
    expect(res[1].widgets[0]).toMatchObject({ id: "a", x: 1, y: 0 });
  });

  it("tauscht über Gruppengrenzen: Bewohner wandert in die Herkunftsgruppe", () => {
    const groups = [g("g1", 4, [w("a", 0, 0)]), g("g2", 4, [w("b", 1, 1)])];
    const res = placeWidget(groups, "a", "g2", 1, 1);
    const g1 = res.find((x) => x.id === "g1")!;
    const g2 = res.find((x) => x.id === "g2")!;
    expect(g2.widgets.map((x) => x.id)).toEqual(["a"]);
    expect(g2.widgets[0]).toMatchObject({ x: 1, y: 1 });
    expect(g1.widgets.map((x) => x.id)).toEqual(["b"]);
    expect(g1.widgets[0]).toMatchObject({ x: 0, y: 0 }); // b bekommt a's alte Zelle
  });
});

describe("moveGroup", () => {
  it("verschiebt eine Gruppe nach hinten", () => {
    const groups = [g("g1", 4, []), g("g2", 4, []), g("g3", 4, [])];
    const res = moveGroup(groups, "g1", 1);
    expect(res.map((x) => x.id)).toEqual(["g2", "g1", "g3"]);
  });

  it("macht nichts an den Rändern", () => {
    const groups = [g("g1", 4, []), g("g2", 4, [])];
    expect(moveGroup(groups, "g1", -1).map((x) => x.id)).toEqual(["g1", "g2"]);
    expect(moveGroup(groups, "g2", 1).map((x) => x.id)).toEqual(["g1", "g2"]);
  });
});

describe("rowCount", () => {
  it("zählt die belegten Zeilen (inkl. Höhe)", () => {
    expect(rowCount(g("g1", 4, [w("a", 0, 0), w("b", 0, 2)]))).toBe(3);
    expect(rowCount(g("g1", 4, []))).toBe(1);
  });
});
