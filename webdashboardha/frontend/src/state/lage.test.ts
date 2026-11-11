import { describe, expect, it } from "vitest";
import boardJson from "../../mock/board.json";
import statesJson from "../../mock/states.json";
import { buildLage, lageHeight, LAGE_HEIGHT } from "./lage";
import type { Board, EntityState } from "./model";

const board = boardJson as unknown as Board;
const NOW = new Date(2026, 10, 11, 18, 20).getTime();
const min = (m: number) => NOW - m * 60000;

/** Quiet base: every source present and normal; overrides per test. */
function states(over: Record<string, Partial<EntityState>> = {}) {
  const base = JSON.parse(JSON.stringify(statesJson)) as Record<string, EntityState>;
  const quiet: Record<string, Partial<EntityState>> = {
    "sensor.waschmaschiene_alex_zustand": { state: "off" },
    "sensor.alex_wohnung_spulmaschiene_zustand": { state: "off" },
    "sensor.alex_wohnung_luftwerte_kohlendioxid": { state: "640" },
    "sensor.schimmelrisiko_bad": { state: "60" },
    "sensor.schimmelrisiko_wohnbereich": { state: "62" },
    "todo.einkaufsliste_2": { state: "2" },
  };
  const all = { ...quiet, ...over };
  for (const id in all) base[id] = { ...(base[id] || { entity_id: id, attributes: {} }), ...all[id] } as EntityState;
  return (id: string) => base[id];
}

describe("buildLage, quiet", () => {
  it("has only rows in the fixed order", () => {
    const l = buildLage(board, states(), NOW);
    expect(l.blocks).toEqual([]);
    expect(l.rows.map((r) => r.key)).toEqual(["oeffnungen", "waesche", "spuelmaschine", "sauger", "innen", "luft", "musik", "lichter", "einkauf"]);
    const v: Record<string, string> = {};
    for (const r of l.rows) v[r.key] = r.value;
    expect(v).toMatchObject({ oeffnungen: "alles zu", waesche: "aus", sauger: "in der Station", luft: "gut", musik: "aus", einkauf: "2 offen" });
    expect(v.lichter).toMatch(/^\d+ an$/);
  });
  it("P4: washer, dishwasher and vacuum rows open their popups", () => {
    const taps: Record<string, unknown> = {};
    for (const r of buildLage(board, states(), NOW).rows) taps[r.key] = r.tap;
    expect(taps.waesche).toEqual({ t: "item", id: "virtual.waesche" });
    expect(taps.spuelmaschine).toEqual({ t: "item", id: "virtual.spuelmaschine" });
    expect(taps.sauger).toEqual({ t: "vacuum" });
    const off = buildLage(board, states({ "vacuum.dreame": { state: "unavailable" } }), NOW).rows.filter((r) => r.key === "sauger")[0];
    expect(off).toMatchObject({ value: "offline", tap: { t: "vacuum" } });
  });
  it("an opening below its threshold stays a row", () => {
    const l = buildLage(board, states({ "binary_sensor.alex_wohnung_kuhlschranktur_tur": { state: "on", lc_ts: NOW - 20000 } }), NOW);
    expect(l.blocks).toEqual([]);
    expect(l.rows[0].value).toBe("Kühlschrank offen");
  });
});

describe("blocks", () => {
  const busy = {
    "binary_sensor.alex_wohnung_kuhlschranktur_tur": { state: "on", lc_ts: min(3) },
    "sensor.waschmaschiene_alex_zustand": { state: "running" },
    "sensor.waschmaschiene_alex_verbleibende_zeit": { state: "42" },
    "sensor.waschmaschiene_alex_fortschritt": { state: "62" },
    "sensor.waschmaschiene_alex_aktuelle_phase": { state: "Spülen" },
    "sensor.alex_wohnung_luftwerte_kohlendioxid": { state: "1021" },
  };
  it("orders red > amber > warm and drops the rows that became blocks", () => {
    const l = buildLage(board, states(busy), NOW);
    expect(l.blocks.map((b) => [b.key, b.tone])).toEqual([["oeffnungen", "red"], ["luft", "amber"], ["waesche", "warm"]]);
    expect(l.blocks[0]).toMatchObject({ head: "Kühlschrank", big: "Offen", small: "3 min", sub: "seit 18:17, Küche" });
    expect(l.blocks[2]).toMatchObject({ big: "noch 42", small: "min", sub: "Spülen, fertig ca. 19:02", progress: 62 });
    expect(l.blocks[1].sub).toBe("CO₂ 1021 ppm, 15 min empfohlen");
    const keys = l.rows.map((r) => r.key);
    for (const k of ["oeffnungen", "luft", "waesche"]) expect(keys).not.toContain(k);
  });
  it("shows at most 3 blocks, a 4th becomes a coloured row", () => {
    const l = buildLage(board, states({ ...busy, "sensor.alex_wohnung_spulmaschiene_zustand": { state: "finished", lc_ts: min(30) } }), NOW);
    expect(l.blocks.length).toBe(3);
    // amber dishwasher outranks the warm washing machine
    expect(l.blocks.map((b) => b.key)).toEqual(["oeffnungen", "spuelmaschine", "luft"]);
    const w = l.rows.filter((r) => r.key === "waesche")[0];
    expect(w).toMatchObject({ value: "noch 42 min", tone: "on" });
  });
  it("fits into 630 px and trims quiet rows in lage_trim_order", () => {
    const heavy = {
      ...busy,
      "sensor.alex_wohnung_spulmaschiene_zustand": { state: "running" },
      "sensor.alex_wohnung_spulmaschiene_verbleibende_zeit": { state: "80" },
      "sensor.alex_wohnung_spulmaschiene_fortschritt": { state: "10" },
      "vacuum.dreame": { state: "cleaning", attributes: { cleaning_progress: 30 } },
    };
    const l = buildLage(board, states(heavy), NOW);
    expect(l.blocks.length).toBe(3);
    expect(lageHeight(l.blocks, l.rows.length)).toBeLessThanOrEqual(LAGE_HEIGHT);
    const kept = l.rows.map((r) => r.key);
    expect(kept).not.toContain("einkauf");
    expect(kept).toContain("lichter");
  });
  it("finished washing: amber 'Fertig, seit 18:42, ausräumen'", () => {
    const l = buildLage(board, states({ "sensor.waschmaschiene_alex_zustand": { state: "finished", lc_ts: new Date(2026, 10, 11, 18, 0).getTime() } }), NOW);
    expect(l.blocks[0]).toMatchObject({ key: "waesche", tone: "amber", big: "Fertig", sub: "seit 18:00, ausräumen" });
  });
});

describe("air without the CO₂ station (R8)", () => {
  const offline = { "sensor.alex_wohnung_luftwerte_kohlendioxid": { state: "unavailable" } };
  it("mould risk >= 80 still raises a block", () => {
    const l = buildLage(board, states({ ...offline, "sensor.schimmelrisiko_bad": { state: "82" } }), NOW);
    expect(l.blocks[0]).toMatchObject({ key: "luft", tone: "amber", big: "Lüften", sub: "Schimmelrisiko Bad 82 %" });
  });
  it("'Heizen' when airing does not help", () => {
    const l = buildLage(board, states({ ...offline, "sensor.schimmelrisiko_bad": { state: "85" }, "binary_sensor.luften_lohnt_sich": { state: "off" } }), NOW);
    expect(l.blocks[0].big).toBe("Heizen");
  });
  it("the row shows a value from the mould risk", () => {
    const l = buildLage(board, states(offline), NOW);
    expect(l.rows.filter((r) => r.key === "luft")[0].value).toBe("Schimmelrisiko 62 %");
  });
  it("'keine Daten' only when every source is gone", () => {
    const l = buildLage(board, states({ ...offline, "sensor.schimmelrisiko_bad": { state: "unavailable" }, "sensor.schimmelrisiko_wohnbereich": { state: "unknown" } }), NOW);
    expect(l.rows.filter((r) => r.key === "luft")[0].value).toBe("keine Daten");
  });
});
