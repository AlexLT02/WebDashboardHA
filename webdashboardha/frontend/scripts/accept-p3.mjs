// P3 acceptance against the mock (04 §6 P3): renders of the start screen, Alles aus
// (hold, snapshot, script, undo), Ambiente on/off sets, K&G covers, Lage fit, popups.
// Requires the mock server: npx vite --config vite.mock.config.mts
import { resolve } from "node:path";
import { calls, clearCalls, launch, mock, MOCK, NAME_CHECK, sleep } from "./cdp.mjs";

const OUT = process.argv[2] || resolve("../../docs/konzept-v2/abnahme");
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
};
const svc = (cs) => cs.filter((c) => c.domain !== "zones");
const fmt = (cs) => JSON.stringify(cs.map((q) => `${q.domain}.${q.service}`));
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.indexOf(x) !== -1);
const board = await (await fetch(`${MOCK}/api/board`)).json();
const kgOf = (role) => board.start.kommen_gehen.filter((k) => k.role === role)[0];

const c = await launch();
const notice = () => c.eval(`(() => { const n = document.querySelector('.undo'); return n ? n.textContent : null; })()`);
const fit = () => c.eval(`(() => { const l = document.querySelector('.lage').getBoundingClientRect(); const s = document.querySelector('.start-left').getBoundingClientRect();
  return { lageBottom: Math.round(l.bottom), leftBottom: Math.round(s.bottom), scroll: document.documentElement.scrollHeight - innerHeight, blocks: document.querySelectorAll('.lage .alert').length }; })()`);
try {
  // ---- renders --------------------------------------------------------------
  await mock("/__mock/scenario", { name: "mockup-start" });
  await c.goto(`${MOCK}/?screen=start&now=2026-11-11T14:12:00`, 2500);
  await c.shot(resolve(OUT, "p3-start.png"));
  let names = await c.eval(NAME_CHECK);
  check("Start: kein abgeschnittener Name (8 % Reserve)", names.bad.length === 0, `${names.checked} geprüft, max ${names.worst} ${names.bad.join(" | ")}`);
  let f = await fit();
  check("Start passt ohne Scrollen (Favoriten <= 692, Lage <= 752)", f.scroll <= 0 && f.leftBottom <= 692 && f.lageBottom <= 752, JSON.stringify(f));
  check("15 Favoriten gezeichnet", (await c.eval(`document.querySelectorAll('.start-left .grid3:not(.grid3--kg) > *').length`)) === 15);

  await mock("/__mock/scenario", { name: "mockup-evening" });
  await c.goto(`${MOCK}/?screen=start&now=2026-11-11T18:20:00`, 2500);
  await c.eval(`(() => { const w = window.__wdh; const b = w.useStore.getState().board;
    w.showOffResult({ scope: 'zone', id: 'bad' }, { undo: 'u9', label: 'Bad: Licht aus', count: 2, hint: null, partial: false, expires_in: 10 });
    w.beginPending(b.items['light.alex_wohnung_eingangsbereich'], true, b);
    const h = document.querySelector('[data-id="kg.alles_aus"]'); h.classList.add('is-holding');
    const fl = h.querySelector('.hold-fill'); fl.style.transition = 'none'; fl.style.webkitTransition = 'none'; fl.style.transform = 'translateX(-38%)';
    const t = document.querySelector('.undo__time'); if (t) { t.style.animation = 'none'; t.style.transform = 'scaleX(0.64)'; } return 1; })()`);
  await sleep(1300);
  await c.shot(resolve(OUT, "p3-start-zustaende.png"));
  f = await fit();
  check("Zustände: roter + warmer Block, Lage <= 752", f.blocks === 2 && f.lageBottom <= 752, JSON.stringify(f));
  check("Roter Punkt an Küche in der Leiste", (await c.eval(`document.querySelectorAll('.rail__dot').length`)) === 1);
  const lichter = await c.eval(`Array.prototype.filter.call(document.querySelectorAll('.lage .row'), (r) => /Lichter/.test(r.textContent))[0].textContent`);
  check("Lichter-Zeile mit Offline-Zusatz", / an · 1 offline/.test(lichter), lichter);

  // 3 blocks + top notice still fit
  await mock("/__mock/state", { entity_id: "sensor.alex_wohnung_spulmaschiene_zustand", state: "running" });
  await mock("/__mock/state", { entity_id: "sensor.alex_wohnung_spulmaschiene_verbleibende_zeit", state: "80" });
  await mock("/__mock/state", { entity_id: "sensor.alex_wohnung_spulmaschiene_fortschritt", state: "10" });
  await mock("/__mock/state", { entity_id: "vacuum.dreame", state: "cleaning" });
  await c.eval(`window.__wdh.showOffResult({ scope: 'alles_aus' }, { undo: 'u10', label: 'Alles aus', count: 11, hint: 'Fenster Bad offen', partial: false, expires_in: 10 }); 1`);
  await sleep(600);
  await c.shot(resolve(OUT, "p3-start-3-bloecke.png"));
  f = await fit();
  const undoBox = await c.center(".undo");
  check("3 Blöcke + TopNotice: passt ohne Scrollen, Lage <= 752", f.blocks === 3 && f.lageBottom <= 752 && f.scroll <= 0, JSON.stringify(f));
  check("TopNotice x 552..1008, y 24, 456 x 56 (nie über Uhr/Datum)", undoBox && undoBox.l === 552 && undoBox.t === 24 && undoBox.w === 456 && undoBox.h === 56, JSON.stringify(undoBox));

  // ---- Alles aus ------------------------------------------------------------------
  await mock("/__mock/scenario", { name: "mockup-start" });
  await c.goto(`${MOCK}/?screen=start&now=2026-11-11T14:12:00`, 2500);
  const hold = await c.center('[data-id="kg.alles_aus"]');
  await clearCalls();
  await c.tap(hold.x, hold.y, 80);
  await sleep(250);
  const sub = await c.eval(`document.querySelector('[data-id="kg.alles_aus"] .tile__sub').textContent`);
  await sleep(300);
  check("Alles aus, kurzer Tipp: 'Zum Ausschalten halten', kein Aufruf", sub === "Zum Ausschalten halten" && svc(await calls()).length === 0, `${sub} ${fmt(svc(await calls()))}`);
  await sleep(2200);
  await clearCalls();
  await c.touch("touchStart", [{ x: hold.x, y: hold.y }]);
  await sleep(350);
  const midHold = await c.eval(`document.querySelector('[data-id="kg.alles_aus"]').className + ' | ' + document.querySelector('[data-id="kg.alles_aus"] .tile__sub').innerText`);
  const beforeFire = svc(await calls()).length;
  await sleep(450);
  await c.touch("touchEnd", []);
  await sleep(700);
  let cs = svc(await calls());
  check("Halten: Füllung läuft, 'weiter halten', vor 600 ms kein Aufruf", /is-holding/.test(midHold) && /weiter halten/.test(midHold) && beforeFire === 0, midHold);
  const scene = cs.filter((q) => q.domain === "scene" && q.service === "create")[0];
  const script = cs.filter((q) => q.domain === "script" && q.service === "turn_on")[0];
  const snap = scene ? scene.data.snapshot_entities : [];
  check("Halten 0,6 s: scene.create, danach script.turn_on script.alles_aus", !!scene && !!script && cs.indexOf(scene) < cs.indexOf(script) && script.entity_id === "script.alles_aus", fmt(cs));
  check("Snapshot ohne light.zone_* und ohne media_player.*", snap.length > 0 && !snap.some((e) => /^light\.zone_|^media_player\./.test(e)), `${snap.length} Entitäten`);
  const txt = await notice();
  check("Leiste 'N Geräte aus' mit Rückgängig", /^\d+ Geräte aus/.test(txt || "") && /Rückgängig/.test(txt || ""), txt);
  await clearCalls();
  const undoBtn = await c.center(".undo__btn");
  await c.tap(undoBtn.x, undoBtn.y);
  await sleep(600);
  cs = svc(await calls());
  check("Rückgängig ruft scene.turn_on scene.wdh_undo", cs.length === 1 && cs[0].domain === "scene" && cs[0].service === "turn_on" && cs[0].entity_id === "scene.wdh_undo", fmt(cs));
  check("danach 'Rückgängig gemacht'", /Rückgängig gemacht/.test((await notice()) || ""), await notice());

  // ---- Ambiente on / off ----------------------------------------------------------------
  const amb = kgOf("ambiente");
  await mock("/__mock/scenario", { name: "mockup-start" });
  for (const id of amb.action) await mock("/__mock/state", { entity_id: id, state: "off" });
  await c.goto(`${MOCK}/?screen=start&now=2026-11-11T14:12:00`, 2500);
  await clearCalls();
  const ambTile = await c.center('[data-id="kg.ambiente"]');
  check("Ambiente aus: Status 'Aus'", (await c.eval(`document.querySelector('[data-id="kg.ambiente"] .tile__sub').textContent`)) === "Aus");
  await c.tap(ambTile.l + 30, ambTile.y);
  await sleep(700);
  cs = svc(await calls());
  const on = cs.filter((q) => q.domain === "homeassistant" && q.service === "turn_on")[0];
  check(`Ambiente an: homeassistant.turn_on mit genau der action-Menge (${amb.action.length})`, cs.length === 1 && !!on && sameSet(on.entity_id, amb.action), on ? `${on.entity_id.length} Entitäten` : fmt(cs));
  await sleep(600);
  const st = await c.eval(`document.querySelector('[data-id="kg.ambiente"] .tile__sub').textContent`);
  check(`Ambiente zählt ohne iPad-Leiste ('${amb.count.length} von ${amb.count.length} an')`, st === `${amb.count.length} von ${amb.count.length} an`, st);
  await clearCalls();
  await c.tap(ambTile.l + 30, ambTile.y);
  await sleep(700);
  cs = svc(await calls());
  const off = cs.filter((q) => q.domain === "homeassistant" && q.service === "turn_off")[0];
  check("Ambiente aus: homeassistant.turn_off mit den eingeschalteten der count-Menge, ohne iPad-Leiste", !!off && sameSet(off.entity_id, amb.count) && off.entity_id.indexOf("light.ipad_backlights") === -1, off ? `${off.entity_id.length} Entitäten` : fmt(cs));
  check("Ambiente aus bietet Rückgängig", /Rückgängig/.test((await notice()) || ""), await notice());

  // ---- K&G group + covers ---------------------------------------------------------
  await mock("/__mock/scenario", { name: "mockup-start" });
  await c.goto(`${MOCK}/?screen=start&now=2026-11-11T14:12:00`, 2500);
  await clearCalls();
  const wl = await c.center('[data-id="light.zone_wohnlicht"]');
  await c.tap(wl.l + 30, wl.y);
  await sleep(600);
  cs = svc(await calls());
  check("Wohnlicht aus -> Tipp: actions/on group light.zone_wohnlicht", cs.length === 1 && cs[0].via === "actions/on:group" && cs[0].entity_id === "light.zone_wohnlicht", fmt(cs));
  await sleep(400);
  await clearCalls();
  const up = await c.center('[data-id="kg.covers"] .cbtn');
  await c.tap(up.x, up.y);
  await sleep(500);
  cs = svc(await calls());
  const ids = kgOf("covers").covers.map((x) => x.id);
  check("Rollläden ▲ wirkt auf beide", cs.length === 1 && cs[0].service === "open_cover" && sameSet(cs[0].entity_id, ids), JSON.stringify(cs.map((q) => q.entity_id)));

  // ---- popups: open from the start screen, height <= 680, no scroll ----------------
  const popupInfo = () => c.eval(`(() => { const p = document.querySelector('.scrim:not(.is-closing) .popup'); if (!p) return null; const r = p.getBoundingClientRect();
    return { h: Math.round(r.height), top: Math.round(r.top), over: p.scrollHeight - p.clientHeight, name: p.querySelector('.popup__name').textContent }; })()`);
  const closePopup = async () => {
    const x = await c.center(".popup__x");
    if (x) await c.tap(x.x, x.y);
    await sleep(450);
  };
  const tapOpen = async (sel, dx) => {
    const r = await c.center(sel);
    await c.tap(dx === undefined ? r.x : r.l + dx, r.y);
    await sleep(500);
    return popupInfo();
  };
  let p = await tapOpen('[data-id="kg.ambiente"]', 150);
  check("Ambiente-Fläche öffnet Gruppen-Popup (count-Menge)", !!p && p.name === "Ambiente" && p.h <= 680 && p.over <= 0, JSON.stringify(p));
  await c.shot(resolve(OUT, "p3-popup-ambiente.png"));
  await closePopup();
  p = await tapOpen('[data-id="kg.covers"]', 120);
  check("Rollläden-Fläche öffnet 'Alle Rollläden'", !!p && p.name === "Rollläden" && p.h <= 680 && p.over <= 0, JSON.stringify(p));
  await closePopup();
  const rowSel = (k) => `Array.prototype.filter.call(document.querySelectorAll('.lage .row'), (r) => /${k}/.test(r.textContent))[0]`;
  await c.eval(`${rowSel("Lichter")}.setAttribute('data-t', 'lichter'); ${rowSel("Öffnungen")}.setAttribute('data-t', 'oeff'); 1`);
  p = await tapOpen('[data-t="lichter"]');
  check("Lage 'Lichter' öffnet 'Was ist an?'", !!p && p.name === "Was ist an?" && p.h <= 680 && p.over <= 0, JSON.stringify(p));
  await c.shot(resolve(OUT, "p3-popup-was-ist-an.png"));
  await clearCalls();
  const allOff = await c.center(".popup .bigsw");
  await c.tap(allOff.x, allOff.y);
  await sleep(700);
  cs = svc(await calls());
  check("'Alle Lichter aus': scene.create + light.turn_off, Rückgängig", cs.some((q) => q.via === "actions/off:lights" && q.service === "turn_off") && /Rückgängig/.test((await notice()) || ""), fmt(cs));
  await closePopup();
  await c.eval(`${rowSel("Öffnungen")}.setAttribute('data-t', 'oeff'); 1`);
  p = await tapOpen('[data-t="oeff"]');
  const rows = await c.eval(`document.querySelectorAll('.popup .mrow').length`);
  check("Lage 'Öffnungen' öffnet Kontakte (7 Zeilen à 56)", !!p && rows === 7 && p.h <= 680 && p.over <= 0, JSON.stringify(p) + ` rows ${rows}`);
  await closePopup();

  // Undo after zone off and group off (chip)
  await mock("/__mock/scenario", { name: "mockup-day" });
  await c.goto(`${MOCK}/?screen=zone:wohnbereich&now=2026-11-11T14:12:00`, 2200);
  const chip = await c.center('.chip[data-id="light.zone_ambiente_sofa"]');
  await c.tap(chip.l + 20, chip.y);
  await sleep(700);
  check("Gruppe aus (Chip) bietet Rückgängig", /Rückgängig/.test((await notice()) || ""), await notice());
  // The notice covers "Licht aus N" (both at the top right) until it expires (8 s).
  await sleep(8500);
  check("Leiste verschwindet nach Ablauf (8 s)", (await notice()) === null, await notice());
  const zoneOff = await c.center(".zone__off");
  await c.tap(zoneOff.x, zoneOff.y);
  await sleep(700);
  check("Zone aus bietet Rückgängig", /Licht aus/.test((await notice()) || "") && /Rückgängig/.test((await notice()) || ""), await notice());

  const errs = c.logs.filter((l) => l.startsWith("exception") || l.startsWith("error"));
  check("keine JS-Fehler", errs.length === 0, errs.slice(0, 5).join(" | "));
} finally {
  c.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} bestanden`);
process.exit(failed ? 1 : 0);
