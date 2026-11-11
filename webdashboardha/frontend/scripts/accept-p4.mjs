// P4 acceptance against the mock (04 §6 P4): Klima (collected set point, boost,
// mode, never hvac on a thermostat), Klima einfach, Fernsehen (Fire TV on, IR
// volume collected), Musik (<= 4 volume calls/s, mute only is_volume_muted),
// Sauger (segments), Gerät (Wäsche/Spülmaschine), every popup <= 680 px.
// Requires the mock server: npx vite --config vite.mock.config.mts
import { resolve } from "node:path";
import { calls, clearCalls, launch, mock, MOCK, sleep } from "./cdp.mjs";

const OUT = process.argv[2] || resolve("../../docs/konzept-v2/abnahme");
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
};
const svc = (cs) => cs.filter((c) => c.domain !== "zones");
const fmt = (cs) => JSON.stringify(cs.map((q) => `${q.domain}.${q.service} ${JSON.stringify(q.entity_id)} ${q.data ? JSON.stringify(q.data) : ""}`));
const board = await (await fetch(`${MOCK}/api/board`)).json();
const THERMOSTATS = Object.keys(board.items).filter((id) => board.items[id].kind === "climate_tuya");
const allCalls = [];

const c = await launch();
const popupInfo = () =>
  c.eval(`(() => { const p = document.querySelector('.scrim:not(.is-closing) .popup'); if (!p) return null; const r = p.getBoundingClientRect();
    return { h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom), over: p.scrollHeight - p.clientHeight, name: p.querySelector('.popup__name').textContent,
      state: (p.querySelector('.popup__state') || {}).textContent || '' }; })()`);
/** Centre of the first element under `sel` whose text matches `re`. */
const byText = (sel, re) =>
  c.eval(`(() => { const re = new RegExp(${JSON.stringify(re)}); const e = Array.prototype.filter.call(document.querySelectorAll(${JSON.stringify(sel)}), (x) => re.test(x.textContent))[0];
    if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: e.textContent, cls: e.className }; })()`);
const tapSel = async (sel, re) => {
  const p = re ? await byText(sel, re) : await c.center(sel);
  if (!p) throw new Error(`not found: ${sel} ${re || ""}`);
  await c.tap(p.x, p.y);
  return p;
};
const text = (sel) => c.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? e.textContent : null; })()`);
const collect = async () => {
  const cs = svc(await calls());
  allCalls.push(...cs);
  return cs;
};
const popups = [];
const measure = async (label, file) => {
  const p = await popupInfo();
  popups.push({ label, p });
  if (file) await c.shot(resolve(OUT, file));
  return p;
};

try {
  // ---- Klima (climate_tuya) ------------------------------------------------------------
  await mock("/__mock/scenario", { name: "base" });
  await c.goto(`${MOCK}/?screen=zone:wohnbereich&popup=climate.thermostat_wohnbereich_alex&now=2026-11-11T18:20:00`, 2200);
  let p = await measure("Klima", "p4-popup-klima.png");
  check("Klima: Popup offen, Kopf Ist -> Soll", !!p && p.name === "Heizung" && /→/.test(p.state), JSON.stringify(p));
  check("Klima: kein An/Aus, kein Modus-Umschalter (nur Heizmodus-Helfer)", (await c.eval(`document.querySelectorAll('.popup .bigsw, .popup .seg').length`)) === 0);
  await clearCalls();
  const plus = await c.center(".popup .stepper__btn--r");
  for (let i = 0; i < 3; i++) {
    await c.tap(plus.x, plus.y, 40);
    await sleep(380); // the same target needs > 350 ms between taps (debounce)
  }
  const shownLocal = await text(".popup .stepper__v");
  const before = (await collect()).length;
  await sleep(1300);
  let cs = await collect();
  const temps = cs.filter((q) => q.domain === "climate" && q.service === "set_temperature");
  check("Klima: + dreimal schnell -> sofort 24,5°, kein Aufruf vor 800 ms", /24,5°/.test(shownLocal || "") && before === 0, `${shownLocal} vorher ${before}`);
  check("Klima: genau EIN climate.set_temperature (24,5) nach dem letzten Tipp", cs.length === 1 && temps.length === 1 && temps[0].data.temperature === 24.5 && temps[0].entity_id === "climate.thermostat_wohnbereich_alex", fmt(cs));
  await sleep(400);
  const note = await text(".popup .popup__note");
  check("Klima: Grund + Hinweis 'Der Heizplan stellt beim nächsten Wechsel wieder um'", /Modus Komfort, dauerhaft/.test(note || "") && /Der Heizplan stellt beim nächsten Wechsel wieder um/.test(note || ""), note);
  await clearCalls();
  await tapSel(".popup .pbtn", "^Boost 30 min$");
  await sleep(600);
  cs = await collect();
  check("Boost ruft timer.start auf timer.heizung_wohnbereich_boost", cs.length === 1 && cs[0].domain === "timer" && cs[0].service === "start" && cs[0].entity_id === "timer.heizung_wohnbereich_boost", fmt(cs));
  const boostTxt = await text(".popup .pbtn");
  check("Boost aktiv: 'Boost bis HH:MM · Beenden'", /^Boost bis \d\d:\d\d · Beenden$/.test(boostTxt || ""), boostTxt);
  await c.shot(resolve(OUT, "p4-popup-klima-boost.png"));
  await clearCalls();
  await tapSel(".popup .pbtn", "Beenden");
  await sleep(600);
  cs = await collect();
  check("Beenden ruft timer.cancel", cs.length === 1 && cs[0].service === "cancel" && cs[0].entity_id === "timer.heizung_wohnbereich_boost", fmt(cs));
  await clearCalls();
  await tapSel(".popup .qchip", "^Eco$");
  await sleep(600);
  cs = await collect();
  check("Heizmodus Eco: input_select.select_option {option: Eco}", cs.length === 1 && cs[0].domain === "input_select" && cs[0].data.option === "Eco" && cs[0].entity_id === "input_select.heizung_modus", fmt(cs));
  check("Heizmodus: Hinweis 'gilt für Wohnbereich und Bad'", /gilt für Wohnbereich und Bad/.test((await text(".popup .psub")) || ""));
  // Head badge of the thermostat does not switch.
  await clearCalls();
  const hb = await c.center(".popup__head .badge");
  await c.tap(hb.x, hb.y);
  await sleep(600);
  check("Klima: Kopf-Badge schaltet nichts", (await collect()).length === 0);

  // Heating tile on the start screen: Lage "Innen" opens the same popup.
  await c.goto(`${MOCK}/?screen=start&now=2026-11-11T18:20:00`, 2200);
  await tapSel(".lage .row", "Innen");
  await sleep(500);
  p = await popupInfo();
  check("Lage 'Innen' öffnet Klima Wohnbereich", !!p && p.name === "Heizung", JSON.stringify(p));

  // ---- Klima einfach (climate.klima, allowlist) ---------------------------------------------
  await c.goto(`${MOCK}/?screen=alle&popup=climate.klima&now=2026-11-11T18:20:00`, 2200);
  p = await measure("Klima einfach", "p4-popup-klima-einfach.png");
  await clearCalls();
  await tapSel(".popup .seg > div", "^Kühlen$");
  await sleep(600);
  cs = await collect();
  check("Klima einfach: Kühlen -> climate.set_hvac_mode cool nur auf climate.klima", cs.length === 1 && cs[0].service === "set_hvac_mode" && cs[0].entity_id === "climate.klima" && cs[0].data.hvac_mode === "cool", fmt(cs));
  await clearCalls();
  const kplus = await c.center(".popup .stepper__btn--r");
  await c.tap(kplus.x, kplus.y, 40);
  await sleep(1300);
  cs = await collect();
  check("Klima einfach: Soll +1 (Schritt 1) als ein set_temperature", cs.length === 1 && cs[0].service === "set_temperature" && cs[0].data.temperature === 17, fmt(cs));

  // ---- Fernsehen ------------------------------------------------------------------------
  await mock("/__mock/scenario", { name: "base" });
  await c.goto(`${MOCK}/?screen=zone:wohnbereich&popup=virtual.fernsehen&now=2026-11-11T18:20:00`, 2200);
  check("Fernsehen, Modus aus: kein Lauter/Leiser", (await byText(".popup .tbtn", "Lauter")) === null && /Soundanlage: aus/.test((await text(".popup .psub")) || ""));
  await clearCalls();
  await tapSel(".popup .bigsw");
  await sleep(700);
  cs = await collect();
  const tv = board.items["virtual.fernsehen"];
  check("Fernsehen Ein: nur media_player.turn_on auf Fire TV Max, kein Skript", cs.length === 1 && cs[0].domain === "media_player" && cs[0].service === "turn_on" && cs[0].entity_id === tv.primary, fmt(cs));
  await mock("/__mock/state", { entity_id: "input_select.soundanlage_modus", state: "tv" });
  await mock("/__mock/state", { entity_id: tv.primary, state: "playing", attributes: { app_name: "Netflix" } });
  await sleep(500);
  const up = await byText(".popup .tbtn", "Lauter");
  check("Modus tv: Lauter/Leiser sichtbar, Transport sichtbar", !!up && (await c.eval(`document.querySelectorAll('.popup .tbtns')[0].children.length`)) === 3);
  await c.shot(resolve(OUT, "p4-popup-fernsehen.png"));
  p = await measure("Fernsehen (tv, Transport)");
  await clearCalls();
  for (let i = 0; i < 3; i++) {
    await c.tap(up.x, up.y, 40);
    await sleep(380);
  }
  const lauter = (await byText(".popup .tbtn", "Lauter")).text;
  await sleep(1300);
  cs = await collect();
  const ir = cs.filter((q) => q.entity_id === "script.soundanlage_ir_taste");
  check("Lauter 3x -> EIN script.soundanlage_ir_taste {taste: vol_up, anzahl: 3}", cs.length === 1 && ir.length === 1 && ir[0].service === "turn_on" && ir[0].data.variables.anzahl === 3 && ir[0].data.variables.taste === tv.sound.vol_up, `${lauter} ${fmt(cs)}`);
  await clearCalls();
  await tapSel(".popup .tbtn[aria-label='Play oder Pause']");
  await sleep(500);
  cs = await collect();
  check("Play/Pause auf Fire TV Max", cs.length === 1 && cs[0].service === "media_play_pause" && cs[0].entity_id === tv.primary, fmt(cs));
  await clearCalls();
  await tapSel(".popup .tbtn", "Neu abgleichen");
  await sleep(500);
  cs = await collect();
  check("Ton neu abgleichen -> script.turn_on script.soundanlage_anwenden", cs.length === 1 && cs[0].entity_id === "script.soundanlage_anwenden", fmt(cs));
  await clearCalls();
  await tapSel(".popup .ltog", "Ambilight");
  await sleep(500);
  cs = await collect();
  check("Licht-Toggle Ambilight schaltet input_boolean.ambilight", cs.length === 1 && cs[0].entity_id === "input_boolean.ambilight", fmt(cs));
  check("Fernsehen: keine rohen IR-Schalter (switch.*_tv_soundanlage*)", !allCalls.some((q) => /tv_soundanlage/.test(JSON.stringify(q.entity_id))));

  // ---- Medien einfach ------------------------------------------------------------------
  await mock("/__mock/state", { entity_id: "media_player.alex_wohnung_firetv_stick_bett_alex", state: "playing", attributes: { app_name: "YouTube" } });
  await c.goto(`${MOCK}/?screen=zone:bett&popup=media_player.alex_wohnung_firetv_stick_bett_alex&now=2026-11-11T18:20:00`, 2200);
  p = await measure("Medien einfach", "p4-popup-medien.png");
  check("Medien einfach: Ein/Aus + Transport", (await c.eval(`document.querySelectorAll('.popup .bigsw').length + document.querySelectorAll('.popup .tbtn').length`)) === 4);

  // ---- Musik ----------------------------------------------------------------------------
  await mock("/__mock/scenario", { name: "base" });
  await mock("/__mock/state", { entity_id: "input_boolean.multiroom", state: "on" });
  await mock("/__mock/state", { entity_id: "media_player.wohnbereich_snapcast_client", attributes: { is_volume_muted: false, volume_level: 0.3 } });
  await mock("/__mock/state", { entity_id: "media_player.bad_snapcast_client", attributes: { is_volume_muted: false, volume_level: 0.45 } });
  await c.goto(`${MOCK}/?screen=start&popup=input_boolean.multiroom&name=Musik&now=2026-11-11T18:20:00`, 2200);
  await c.eval(`(() => { window.__svc = []; const of = window.fetch; window.fetch = function (u, o) {
    if (String(u).indexOf('/api/service') !== -1) window.__svc.push({ t: performance.now(), body: JSON.parse(o.body) }); return of.apply(this, arguments); }; return 1; })()`);
  const bar = await c.center('.popup .vrow[data-id="media_player.wohnbereich_snapcast_client"] .bar');
  await clearCalls();
  await c.touch("touchStart", [{ x: bar.l + 10, y: bar.y }]);
  const t0 = Date.now();
  let step = 0;
  while (Date.now() - t0 < 2000) {
    step += 1;
    await c.touch("touchMove", [{ x: bar.l + 10 + ((step * 3) % (bar.w - 20)), y: bar.y }]);
    await sleep(16);
  }
  await c.touch("touchEnd", []);
  await sleep(800);
  const sent = (await c.eval(`window.__svc`)).filter((s) => s.body.service === "volume_set");
  let maxWin = 0;
  let minGap = Infinity;
  for (let i = 0; i < sent.length; i++) {
    let n = 0;
    for (let j = i; j < sent.length && sent[j].t - sent[i].t < 1000; j++) n++;
    maxWin = Math.max(maxWin, n);
    if (i > 0) minGap = Math.min(minGap, sent[i].t - sent[i - 1].t);
  }
  check("Musik: 2 s ziehen -> höchstens 4 volume_set je Sekunde", sent.length >= 6 && maxWin <= 4, `${sent.length} Aufrufe, max ${maxWin}/s, kleinster Abstand ${Math.round(minGap)} ms`);
  check("Musik: volume_set ohne 'muted'", sent.every((s) => Object.keys(s.body.data).join() === "volume_level"));
  await clearCalls();
  await c.eval(`window.__svc = []; 1`);
  await tapSel('.popup .vrow[data-id="media_player.bad_snapcast_client"] .vrow__mute');
  await sleep(600);
  cs = await collect();
  check("Stumm ändert nur is_volume_muted (volume_mute, ein Feld)", cs.length === 1 && cs[0].service === "volume_mute" && Object.keys(cs[0].data).join() === "is_volume_muted" && cs[0].data.is_volume_muted === true, fmt(cs));
  await clearCalls();
  await tapSel(".popup .pbtn", "XP700");
  await sleep(500);
  cs = await collect();
  check("Sony XP700 wecken -> script.turn_on script.xp700_einschalten", cs.length === 1 && cs[0].entity_id === "script.xp700_einschalten" && cs[0].service === "turn_on", fmt(cs));
  await tapSel(".popup .pbtn", "Echos");
  await sleep(400);
  p = await measure("Musik (Echos offen)", "p4-popup-musik.png");
  check("Musik: Echos aufgeklappt (3 Zeilen ohne Stumm)", (await c.eval(`document.querySelectorAll('.popup .vrow--echo').length`)) === 3 && (await c.eval(`document.querySelectorAll('.popup .vrow--echo .vrow__mute').length`)) === 0);

  // ---- Sauger ---------------------------------------------------------------------------
  await mock("/__mock/scenario", { name: "base" });
  await c.goto(`${MOCK}/?screen=start&now=2026-11-11T18:20:00`, 2200);
  await tapSel(".lage .row", "Sauger");
  await sleep(500);
  p = await popupInfo();
  check("Lage 'Sauger' öffnet das Sauger-Popup", !!p && p.name === "Sauger" && /Bereit in der Station, Akku 100 %/.test(p.state), JSON.stringify(p));
  check("Sauger in der Station: nur Starten aktiv", (await c.eval(`Array.prototype.map.call(document.querySelectorAll('.popup .qchip--big'), (e) => /is-disabled/.test(e.className) ? 0 : 1).join('')`)) === "100");
  await clearCalls();
  await tapSel(".popup .qchip", "^Küche$");
  await sleep(380);
  await tapSel(".popup .qchip", "^Bad$");
  await sleep(380);
  const selTxt = await text(".popup .pbtn");
  await tapSel(".popup .pbtn", "Auswahl saugen");
  await sleep(600);
  cs = await collect();
  const seg = cs.filter((q) => q.domain === "dreame_vacuum")[0];
  check("Auswahl saugen (2) mit Küche + Bad -> vacuum_clean_segment segments [4, 1]", selTxt === "Auswahl saugen (2)" && cs.length === 1 && !!seg && seg.service === "vacuum_clean_segment" && seg.entity_id === "vacuum.dreame" && seg.data.segments.slice().sort().join() === "1,4", `${selTxt} ${fmt(cs)}`);
  await sleep(400);
  await clearCalls();
  await tapSel(".popup .qchip", "^Turbo$");
  await sleep(500);
  cs = await collect();
  check("Saugstärke Turbo -> vacuum.set_fan_speed turbo", cs.length === 1 && cs[0].service === "set_fan_speed" && cs[0].data.fan_speed === "turbo", fmt(cs));
  await mock("/__mock/state", { entity_id: "sensor.dreame_error", state: "main_brush_jammed" });
  await sleep(400);
  p = await measure("Sauger (Fehler)", "p4-popup-sauger.png");
  check("Sauger: Fehlerzeile Bernstein", /Fehler: main brush jammed/.test((await text(".popup .popup__note.amber")) || ""));

  // ---- Gerät -----------------------------------------------------------------------------
  await mock("/__mock/scenario", { name: "base" });
  for (const [id, state] of [["sensor.waschmaschiene_alex_zustand", "running"], ["sensor.waschmaschiene_alex_verbleibende_zeit", "42"], ["sensor.waschmaschiene_alex_fortschritt", "55"], ["sensor.waschmaschiene_alex_aktuelle_phase", "Spülen"], ["sensor.waschmaschiene_alex_programm", "Baumwolle 40"]]) {
    await mock("/__mock/state", { entity_id: id, state });
  }
  await c.goto(`${MOCK}/?screen=start&now=2026-11-11T18:20:00`, 2200);
  await tapSel(".lage .alert", "Wäsche");
  await sleep(500);
  p = await measure("Gerät Wäsche (läuft)", "p4-popup-waesche.png");
  const big = await text(".popup .pbig");
  check("Lage-Block Wäsche öffnet Gerät-Popup: 'noch 42 min', fertig ca., Fortschritt 6 px", !!p && p.name === "Wäsche" && /noch 42min/.test(big || "") && /fertig ca\. \d\d:\d\d/.test(big || "") && (await c.eval(`document.querySelector('.popup .progress--6').getBoundingClientRect().height`)) === 6, `${big}`);
  check("Wäsche: Zustand = Phase, Programm", /Spülen/.test((await c.eval(`document.querySelector('.popup .mrows').textContent`)) || "") && /Baumwolle 40/.test((await c.eval(`document.querySelector('.popup .mrows').textContent`)) || ""));
  await mock("/__mock/state", { entity_id: "sensor.alex_wohnung_spulmaschiene_zustand", state: "finished" });
  await mock("/__mock/state", { entity_id: "button.alex_wohnung_spulmaschiene_als_entladen_markieren", state: "unknown" });
  await c.goto(`${MOCK}/?screen=zone:kueche&popup=virtual.spuelmaschine&now=2026-11-11T18:20:00`, 2200);
  p = await measure("Gerät Spülmaschine (fertig)", "p4-popup-spuelmaschine.png");
  await clearCalls();
  await tapSel(".popup .bigsw", "Ausgeräumt");
  await sleep(600);
  cs = await collect();
  check("Spülmaschine fertig: 'Ausgeräumt' -> button.press", cs.length === 1 && cs[0].domain === "button" && cs[0].service === "press" && cs[0].entity_id === "button.alex_wohnung_spulmaschiene_als_entladen_markieren", fmt(cs));

  // ---- every popup fits ---------------------------------------------------------------------
  const bad = popups.filter((x) => !x.p || x.p.h > 680 || x.p.over > 0 || x.p.top < 18 || x.p.bottom > 748);
  check(`Alle ${popups.length} Fach-Popups <= 680 px, ohne Scrollen, zwischen y 18 und 748`, bad.length === 0, popups.map((x) => `${x.label} ${x.p ? x.p.h : "?"}`).join(", "));

  // ---- never an hvac mode or on/off on a heating thermostat ------------------------------------
  const hvac = allCalls.filter((q) => q.domain === "climate" && q.service !== "set_temperature");
  const onThermo = hvac.filter((q) => [].concat(q.entity_id).some((e) => THERMOSTATS.indexOf(e) !== -1));
  check("Laufzeit: kein climate.turn_*/set_hvac_mode auf einem Heizungsthermostat", onThermo.length === 0, `${hvac.length} hvac-Aufrufe, alle auf ${[...new Set(hvac.map((q) => q.entity_id))].join(",") || "-"}`);

  const errs = c.logs.filter((l) => l.startsWith("exception") || l.startsWith("error"));
  check("keine JS-Fehler", errs.length === 0, errs.slice(0, 5).join(" | "));
} finally {
  c.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} bestanden`);
process.exit(failed ? 1 : 0);
