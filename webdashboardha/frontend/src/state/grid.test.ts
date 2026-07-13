import { describe, expect, it } from "vitest";
import {
  emptyCells,
  firstFreeBlock,
  firstFreeCell,
  groupBlockHeight,
  groupBlockWidth,
  moveBlock,
  moveGroup,
  normalizeLayout,
  placeWidget,
  resizeWidget,
  resolveOverlaps,
  rowCount,
  topLevelBlocks,
} from "./grid";
import type { Group, WidgetConfig } from "./dashboards";

function w(id: string, x: number, y: number, ww = 1, hh = 1): WidgetConfig {
  return { id, type: "light", entity_id: `light.${id}`, x, y, w: ww, h: hh, options: {} };
}

function g(id: string, columns: number, widgets: WidgetConfig[]): Group {
  return { id, name: "", columns, widgets };
}

function loose(widgets: WidgetConfig[]): Group {
  return { id: "L", name: "", columns: 6, ungrouped: true, widgets };
}

function grp(id: string, columns: number, widgets: WidgetConfig[], x: number, y: number): Group {
  return { id, name: "", columns, x, y, widgets };
}

function block(groups: Group[], id: string) {
  return topLevelBlocks(groups).find((b) => b.id === id)!;
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

describe("Dashboard-Ebene: Blockmaße", () => {
  it("Gruppen-Breite = Spaltenzahl, gekappt auf 6", () => {
    expect(groupBlockWidth(g("g1", 3, []))).toBe(3);
    expect(groupBlockWidth(g("g1", 9, []))).toBe(6);
  });
  it("Gruppen-Höhe = Kopfzeile + Inhaltszeilen", () => {
    expect(groupBlockHeight(g("g1", 4, [w("a", 0, 0), w("b", 0, 1)]))).toBe(3); // 1 + 2
    expect(groupBlockHeight(g("g1", 4, []))).toBe(2); // 1 + 1 (min)
  });
});

describe("topLevelBlocks", () => {
  it("lose Widgets werden Einzelblöcke, echte Gruppen ein Block mit x/y", () => {
    const gs = [loose([w("wa", 0, 0), w("wb", 4, 0, 2, 1)]), grp("g1", 3, [w("x", 0, 0), w("y", 0, 1)], 0, 0)];
    const blocks = topLevelBlocks(gs);
    expect(blocks).toEqual([
      { id: "wa", x: 0, y: 0, w: 1, h: 1 },
      { id: "wb", x: 4, y: 0, w: 2, h: 1 },
      { id: "g1", x: 0, y: 0, w: 3, h: 3 },
    ]);
  });
});

describe("moveBlock — lose Kachel gegen Gruppen-Block", () => {
  it("legt loses Widget auf (0,0); überlappender Gruppen-Block weicht seitlich aus", () => {
    const gs = [loose([w("wa", 5, 0)]), grp("g1", 3, [w("x", 0, 0), w("y", 0, 1)], 0, 0)];
    const res = moveBlock(gs, "wa", 0, 0);
    expect(block(res, "wa")).toMatchObject({ x: 0, y: 0 });
    // g1 (Breite 3, Höhe 3) rückt an die erste freie Stelle rechts der Kachel.
    expect(block(res, "g1")).toMatchObject({ x: 1, y: 0 });
  });
  it("begrenzt die x-Position auf die Rasterbreite", () => {
    const gs = [loose([w("wb", 0, 0, 2, 1)])];
    const res = moveBlock(gs, "wb", 5, 0);
    expect(block(res, "wb")).toMatchObject({ x: 4, y: 0 }); // 6 - 2
  });
});

describe("normalizeLayout — Altbestand ohne x/y", () => {
  it("gibt Gruppen ohne Position kollisionsfreie Plätze", () => {
    const g1: Group = { id: "g1", name: "", columns: 3, widgets: [w("a", 0, 0)] };
    const g2: Group = { id: "g2", name: "", columns: 3, widgets: [w("b", 0, 0)] };
    const res = normalizeLayout([g1, g2]);
    expect(res.find((x) => x.id === "g1")).toMatchObject({ x: 0, y: 0 });
    // g2 (Breite 3) passt neben g1 in dieselbe Reihe.
    expect(res.find((x) => x.id === "g2")).toMatchObject({ x: 3, y: 0 });
  });
  it("behält bereits gültige, kollisionsfreie Positionen bei", () => {
    const res = normalizeLayout([grp("g1", 2, [w("a", 0, 0)], 2, 1)]);
    expect(res[0]).toMatchObject({ x: 2, y: 1 });
  });
});

describe("firstFreeBlock", () => {
  it("findet die erste freie Dashboard-Zelle über alle Blöcke hinweg", () => {
    const gs = [loose([w("wa", 0, 0)]), grp("g1", 2, [], 1, 0)];
    // (0,0) belegt von wa, (1,0)-(2,1) vom Gruppen-Block -> nächste frei: (3,0)
    expect(firstFreeBlock(gs, 1, 1)).toEqual({ x: 3, y: 0 });
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
