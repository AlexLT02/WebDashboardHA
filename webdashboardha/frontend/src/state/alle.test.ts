import { describe, expect, it } from "vitest";
import boardJson from "../../mock/board.json";
import statesJson from "../../mock/states.json";
import {
  allFacts,
  inboxIds,
  LIST_TABS,
  listGroups,
  moveFavorite,
  newlyPlaced,
  offlineIds,
  orderPeers,
  stufeChange,
  stufeOf,
  stufeOptions,
  validName,
  withZone,
} from "./alle";
import type { Board, EntityState } from "./model";

const board = boardJson as unknown as Board;
const states = statesJson as unknown as Record<string, EntityState>;
const get = (id: string) => states[id];
const NOW = (boardJson as unknown as { generated_now: number }).generated_now * 1000;
const tab = (t: string) => LIST_TABS.filter((x) => x.tab === t)[0].match!;

describe("Alle lists", () => {
  it("facts line counts zone tiles and the inbox", () => {
    expect(inboxIds(board)).toHaveLength(6);
    expect(allFacts(board)).toBe("44 Kacheln in 5 Zonen, 6 ohne Zone");
  });
  it("filter Alle: every zone with tiles, inbox last, nothing hidden", () => {
    const g = listGroups(board, tab("alle"));
    expect(g.map((x) => x.zone)).toEqual(["wohnbereich", "kueche", "pc", "bett", "bad", null]);
    const ids = g.reduce<string[]>((a, x) => a.concat(x.tiles, x.chips), []);
    expect(ids).toContain("light.ipad_backlights"); // "nur Alle"
    expect(ids).not.toContain("switch.pc_power_switch"); // hidden
    expect(ids).not.toContain("virtual.waesche"); // system, no tile
    expect(g[0].chips).toEqual(["light.zone_sofa_deckenlicht", "light.zone_ambiente_sofa", "light.zone_tv"]);
  });
  it("filter Medien vs Geräte vs Klima", () => {
    const flat = (t: string) => listGroups(board, tab(t)).reduce<string[]>((a, x) => a.concat(x.tiles, x.chips), []);
    expect(flat("medien")).toContain("virtual.fernsehen");
    expect(flat("medien")).not.toContain("switch.alex_wohnung_monitore");
    expect(flat("geraete")).toContain("switch.alex_wohnung_monitore");
    expect(flat("geraete")).toContain("virtual.spuelmaschine");
    expect(flat("geraete")).toContain("virtual.pc_platz");
    expect(flat("klima")).toEqual(expect.arrayContaining(["climate.thermostat_wohnbereich_alex", "cover.rolladen_treppe_alex_wohnung", "climate.klima"]));
    expect(flat("licht").every((id) => board.items[id].func === "licht")).toBe(true);
  });
  it("offline counts every tile (bed TV offline in the fixture)", () => {
    expect(offlineIds(board, get, NOW)).toContain("switch.alex_wohnung_fernseher_bett");
  });
  it("Neu eingeordnet: new and already in a zone", () => {
    const ids = newlyPlaced(board);
    expect(ids).toEqual(expect.arrayContaining(["switch.alex_wohnung_monitore", "switch.alex_wohnung_interface", "virtual.spuelmaschine"]));
    expect(ids.every((id) => !board.items[id].inbox)).toBe(true);
    expect(withZone("PC", "An, 5 W")).toBe("PC, an, 5 W");
  });
});

describe("edit sheet", () => {
  const eingang = board.items["light.alex_wohnung_eingangsbereich"];
  const regal = board.items["light.regal_alex_wohnung"];
  it("tier of an item", () => {
    expect(stufeOf(board, eingang)).toBe("start");
    expect(stufeOf(board, regal)).toBe("zone");
    expect(stufeOf(board, board.items["light.ipad_backlights"])).toBe("all");
    expect(stufeOf(board, board.items["switch.pc_power_switch"])).toBe("hidden");
    expect(stufeOptions(board.items["light.zone_kueche"])).toEqual(["start", "zone", "hidden"]);
    expect(stufeOptions(board.items["input_boolean.multiroom"])).toEqual(["start", "zone"]);
  });
  it("star adds to the favourites only when there is room (15)", () => {
    expect(stufeChange(board, regal, "start")).toEqual({ error: "Start ist voll (15)" });
    const fewer = { ...board, start: { ...board.start, favorites: board.start.favorites.slice(0, 3) } };
    expect(stufeChange(fewer, regal, "start").favorites).toEqual(fewer.start.favorites.map((f) => f.id).concat([regal.id]));
  });
  it("hiding a favourite removes it from the start and sets the tier", () => {
    const c = stufeChange(board, eingang, "hidden");
    expect(c.patch).toEqual({ tier: "hidden" });
    expect(c.favorites).toHaveLength(14);
    expect(c.favorites).not.toContain(eingang.id);
    expect(stufeChange(board, regal, "all")).toEqual({ patch: { tier: "all" } });
    expect(stufeChange(board, board.items["switch.pc_power_switch"], "zone")).toEqual({ patch: { tier: "zone" } });
  });
  it("order peers and favourite moves", () => {
    expect(orderPeers(board, regal.id, "zone")[0]).toBe("light.ambiente_ecklampe");
    expect(orderPeers(board, eingang.id, "fav")).toHaveLength(15);
    expect(moveFavorite(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveFavorite(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
  });
  it("names: 1 to 14 characters", () => {
    expect(validName("  Flur ")).toBe("Flur");
    expect(validName("Bücherregal 14")).toBe("Bücherregal 14");
    expect(validName("x".repeat(15))).toBeNull();
    expect(validName("   ")).toBeNull();
  });
});
