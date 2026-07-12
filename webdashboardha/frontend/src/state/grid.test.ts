import { describe, expect, it } from "vitest";
import {
  emptyCells,
  firstFreeCell,
  moveGroup,
  placeWidget,
  resizeWidget,
  resolveOverlaps,
  rowCount,
} from "./grid";
import type { Group, WidgetConfig } from "./dashboards";

function w(id: string, x: number, y: number, ww = 1, hh = 1): WidgetConfig {
  return { id, type: "light", entity_id: `light.${id}`, x, y, w: ww, h: hh, options: {} };
}

function g(id: string, columns: number, widgets: WidgetConfig[]): Group {
  return { id, name: "", columns, widgets };
}

function pos(group: Group, id: string) {
  const wi = group.widgets.find((x) => x.id === id)!;
  return { x: wi.x, y: wi.y, w: wi.w, h: wi.h };
}

describe("firstFreeCell", () => {
  it("findet die erste freie Zelle zeilenweise", () => {
    expect(firstFreeCell(g("g1", 3, [w("a", 0, 0), w("b", 1, 0)]))).toEqual({ x: 2, y: 0 });
  });
  it("springt in die nächste Zeile, wenn die erste voll ist", () => {
    expect(firstFreeCell(g("g1", 2, [w("a", 0, 0), w("b", 1, 0)]))).toEqual({ x: 0, y: 1 });
  });
});

describe("placeWidget — leere Zielzelle", () => {
  it("verschiebt ein Widget auf eine freie Zelle", () => {
    const res = placeWidget([g("g1", 4, [w("a", 0, 0), w("b", 1, 0)])], "a", "g1", 3, 2);
    expect(pos(res[0], "a")).toMatchObject({ x: 3, y: 2 });
    expect(pos(res[0], "b")).toMatchObject({ x: 1, y: 0 });
  });
});

describe("placeWidget — Kollision: Blocker rutscht weiter", () => {
  it("schiebt den Bewohner der Zielzelle an die nächste freie Stelle", () => {
    const res = placeWidget([g("g1", 4, [w("a", 0, 0), w("b", 2, 1)])], "a", "g1", 2, 1);
    expect(pos(res[0], "a")).toMatchObject({ x: 2, y: 1 });
    // b wich an die erste freie Zelle (0,0)
    expect(pos(res[0], "b")).toMatchObject({ x: 0, y: 0 });
  });
});

describe("placeWidget — zwischen Gruppen", () => {
  it("verschiebt in andere Gruppe und löst dort Kollisionen", () => {
    const res = placeWidget(
      [g("g1", 4, [w("a", 0, 0)]), g("g2", 4, [w("b", 1, 1)])],
      "a",
      "g2",
      1,
      1,
    );
    expect(res.find((x) => x.id === "g1")!.widgets).toHaveLength(0);
    const g2 = res.find((x) => x.id === "g2")!;
    expect(pos(g2, "a")).toMatchObject({ x: 1, y: 1 });
    expect(pos(g2, "b")).toMatchObject({ x: 0, y: 0 }); // b weicht in g2 aus
  });
});

describe("resizeWidget — vergrößern schiebt Nachbarn weg", () => {
  it("macht ein Widget breiter; der überlappte Nachbar rutscht weiter", () => {
    const res = resizeWidget([g("g1", 4, [w("a", 0, 0), w("b", 1, 0)])], "g1", "a", 2, 1);
    expect(pos(res[0], "a")).toMatchObject({ x: 0, y: 0, w: 2, h: 1 });
    expect(pos(res[0], "b")).toMatchObject({ x: 2, y: 0 }); // b weicht nach rechts
  });
  it("begrenzt die Breite auf die Spaltenzahl", () => {
    const res = resizeWidget([g("g1", 3, [w("a", 0, 0)])], "g1", "a", 9, 1);
    expect(pos(res[0], "a").w).toBe(3);
  });
});

describe("resolveOverlaps — Lücken bleiben", () => {
  it("lässt nicht-überlappende Widgets in Ruhe", () => {
    const group = g("g1", 4, [w("a", 0, 0), w("b", 3, 3)]);
    const res = resolveOverlaps(group.widgets, group.columns, "a");
    expect(res.find((x) => x.id === "b")).toMatchObject({ x: 3, y: 3 });
  });
});

describe("moveGroup", () => {
  it("verschiebt eine Gruppe nach hinten", () => {
    const res = moveGroup([g("g1", 4, []), g("g2", 4, []), g("g3", 4, [])], "g1", 1);
    expect(res.map((x) => x.id)).toEqual(["g2", "g1", "g3"]);
  });
});

describe("rowCount / emptyCells", () => {
  it("zählt belegte Zeilen inkl. Höhe", () => {
    expect(rowCount(g("g1", 4, [w("a", 0, 0, 1, 2)]))).toBe(2);
  });
  it("emptyCells überspringt belegte Zellen (auch mehrzellige)", () => {
    const cells = emptyCells(g("g1", 2, [w("a", 0, 0, 2, 1)]), 2);
    expect(cells).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
  });
});
