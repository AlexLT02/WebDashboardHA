// P5 acceptance (04 §6 P5) against the REAL backend: backend/tests/fixture_server.py
// (real routes, ZoneStore, build_board; FakeHA with the fixture snapshot) serving the
// production Legacy bundle (frontend/dist, run `npm run build` first). No deep links:
// everything is reached by touch, like on the iPad. Restarting the server process is
// a real backend restart with the same /data (zones.json).
//   node scripts/accept-p5.mjs [out-dir]
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { launch, NAME_CHECK, sleep } from "./cdp.mjs";

const OUT = process.argv[2] || resolve("../../docs/konzept-v2/abnahme");
const PORT = 8199;
const BASE = `http://127.0.0.1:${PORT}`;
const PY = resolve("../backend/.venv/Scripts/python.exe");
const DATA = mkdtempSync(resolve(tmpdir(), "wdh-p5-"));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
};

let server = null;
async function startServer() {
  server = spawn(PY, ["../backend/tests/fixture_server.py", "--port", String(PORT), "--data", DATA], { stdio: "ignore" });
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`${BASE}/api/board`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("fixture server did not start");
}
async function stopServer() {
  if (!server) return;
  const p = server;
  server = null;
  const gone = new Promise((r) => p.once("exit", r));
  p.kill();
  await gone;
}
const api = async (path, opts) => (await fetch(BASE + path, opts)).json();
const board = () => api("/api/board");
const serviceCalls = async () => (await api("/__fixture/calls")).filter((c) => !(c.domain === "weather" && c.service === "get_forecasts"));

await startServer();
const c = await launch();
const text = (sel) => c.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? e.textContent : null; })()`);
const byText = (sel, re) =>
  c.eval(`(() => { const re = new RegExp(${JSON.stringify(re)}); const e = Array.prototype.filter.call(document.querySelectorAll(${JSON.stringify(sel)}), (x) => re.test(x.textContent))[0];
    if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: e.textContent, cls: e.className }; })()`);
const tap = async (sel, re, wait = 450) => {
  const p = re ? await byText(sel, re) : await c.center(sel);
  if (!p) throw new Error(`not found: ${sel} ${re || ""}`);
  await c.tap(p.x, p.y);
  await sleep(wait);
  return p;
};
const popup = () =>
  c.eval(`(() => { const p = document.querySelector('.scrim:not(.is-closing) .popup'); if (!p) return null; const r = p.getBoundingClientRect();
    return { h: Math.round(r.height), over: p.scrollHeight - p.clientHeight, name: p.querySelector('.popup__name').textContent, state: (p.querySelector('.popup__state') || {}).textContent || '' }; })()`);
const closePopup = async () => {
  if (await c.center(".scrim:not(.is-closing) .popup__x")) await tap(".popup__x", null, 500);
};
const inboxRows = () => c.eval(`Array.prototype.map.call(document.querySelectorAll('.inrow'), (e) => e.getAttribute('data-id'))`);
const tileIn = (zoneId, id) => c.eval(`!!document.querySelector('[data-zone="${zoneId}"] [data-id="${id}"]')`);
const typeName = async (value) => {
  await c.eval(`(() => { const i = document.querySelector('.popup .ename__in'); i.focus(); i.select(); return 1; })()`);
  await c.send("Input.insertText", { text: value });
  await sleep(200);
  return c.eval(`document.querySelector('.popup .ename__in').value`);
};

try {
  await c.goto(BASE + "/", 2500);
  check("Produktions-Bundle (Legacy) lädt gegen das echte Backend", (await c.eval(`document.querySelectorAll('.rail__item').length`)) === 8, await text(".rail"));

  // ---- Eingangskorb ------------------------------------------------------------------
  await tap(".rail__item", "Alle$", 600);
  const facts = await text(".alle .zone__facts");
  check("Alle: Titel + 'N Kacheln in 5 Zonen, M ohne Zone'", /^\d+ Kacheln in 5 Zonen, 6 ohne Zone$/.test(facts || ""), facts);
  check("Alle: Filter Alle · Licht · Ambiente · Medien · Geräte · Klima · Offline N · Neu N",
    (await c.eval(`Array.prototype.map.call(document.querySelectorAll('.fchip'), (e) => e.textContent).join('|')`)).replace(/\d+/g, "N") === "Alle|Licht|Ambiente|Medien|Geräte|Klima|OfflineN|NeuN");
  const sc = await c.eval(`(() => { const l = document.querySelector('.alle__list'); return { list: l.scrollHeight > l.clientHeight, body: document.documentElement.scrollHeight - innerHeight, top: Math.round(l.getBoundingClientRect().top) }; })()`);
  check("Liste ist die einzige scrollende Fläche, Kopf und Filter stehen", sc.list && sc.body <= 0 && sc.top === 140, JSON.stringify(sc));
  let nc = await c.eval(NAME_CHECK);
  check("Alle: kein abgeschnittener Name (8 % Reserve)", nc.bad.length === 0, `${nc.checked} geprüft, max ${nc.worst} ${nc.bad.join(" | ")}`);
  await tap(".fchip", "^Licht$");
  check("Filter Licht zeigt nur Licht-Kacheln", await c.eval(`(() => { const ids = Array.prototype.map.call(document.querySelectorAll('.alle__list .tile'), (e) => e.getAttribute('data-id')); return ids.length > 10 && ids.every((i) => /^light\\./.test(i)); })()`));
  await tap(".fchip", "^Neu");
  let rows = await inboxRows();
  check("Eingangskorb zeigt 6 Einträge", rows.length === 6, rows.join(", "));
  const sug = await c.eval(`Array.prototype.map.call(document.querySelectorAll('.inrow .zbtn.is-sug'), (e) => e.closest('.inrow').getAttribute('data-id') + ':' + e.textContent).join(', ')`);
  check("Vorschlag blau umrandet (PC 2, LAN-Switch -> PC)", /switch\.pc_2_strom_steckdose_1:PC/.test(sug) && /switch\.switch_alex_steckdose_1:PC/.test(sug), sug);
  nc = await c.eval(NAME_CHECK);
  check("Neu: kein abgeschnittener Name", nc.bad.length === 0, `${nc.checked} geprüft, max ${nc.worst} ${nc.bad.join(" | ")}`);
  await c.shot(resolve(OUT, "p5-eingangskorb.png"));
  const calls0 = (await serviceCalls()).length;
  await tap('.inrow[data-id="climate.klima"] .zbtn', "^Küche$", 1200);
  rows = await inboxRows();
  const plus = await text(".rail__new");
  check("'Küche' antippen: Eintrag verschwindet, Badge '+5' an Alle", rows.length === 5 && rows.indexOf("climate.klima") === -1 && plus === "+5", `${rows.length} Zeilen, Badge ${plus}`);
  check("Neu eingeordnet zeigt Klima mit 'Küche, …'", /^Küche, /.test((await c.eval(`(() => { const t = document.querySelector('.alle__list .grid4 [data-id="climate.klima"] .tile__sub'); return t ? t.textContent : ''; })()`)) || ""));
  await tap(".rail__item", "Küche", 600);
  const newTag = await c.eval(`(() => { const t = document.querySelector('[data-zone="kueche"] [data-id="climate.klima"]'); return t ? { neu: !!t.querySelector('.new'), sub: t.querySelector('.tile__sub').textContent } : null; })()`);
  check("Item erscheint in Küche mit 'neu'", !!newTag && newTag.neu, JSON.stringify(newTag));
  await c.shot(resolve(OUT, "p5-kueche-neu.png"));

  // ---- restart -------------------------------------------------------------------------
  await stopServer();
  await sleep(500);
  await startServer();
  const zjson = JSON.parse(readFileSync(resolve(DATA, "zones.json"), "utf-8"));
  check("zones.json: climate.klima -> kueche", zjson.items["climate.klima"] && zjson.items["climate.klima"].zone === "kueche", JSON.stringify(zjson.items["climate.klima"]));
  // Fresh page against the restarted process: the board comes from the new backend.
  await c.goto(BASE + "/", 3000);
  await tap(".rail__item", "Küche", 600);
  const afterReload = await tileIn("kueche", "climate.klima");
  const neuAfter = await c.eval(`!!document.querySelector('[data-zone="kueche"] [data-id="climate.klima"] .new')`);
  const b1 = await board();
  check("Backend neu gestartet: Zuordnung bleibt (Kachel in Küche, 'neu', Eingangskorb 5)", afterReload && neuAfter && b1.inbox.length === 5 && b1.items["climate.klima"].zone === "kueche", `Kachel ${afterReload}, neu ${neuAfter}, inbox ${b1.inbox.length}`);

  // ---- Ausblenden from the inbox (no edit mode) -------------------------------------------
  await tap(".rail__item", "Alle$", 600);
  await tap(".fchip", "^Neu");
  await tap('.inrow[data-id="input_boolean.lichtshow"] .zbtn', "^Ausblenden$", 1200);
  const b2 = await board();
  check("Eingangskorb 'Ausblenden': Eintrag weg, Item ausgeblendet", (await inboxRows()).indexOf("input_boolean.lichtshow") === -1 && b2.hidden.indexOf("input_boolean.lichtshow") !== -1);

  // ---- Bearbeiten ----------------------------------------------------------------------------
  await tap(".rail__item", "System", 600);
  let p = await popup();
  const svcBtns = await c.eval(`Array.prototype.map.call(document.querySelectorAll('.popup .qchip'), (e) => e.textContent).join('|')`);
  check("Service-Panel: Status + Neu laden, Einstellungen, Bearbeiten, Offline (N), Verwaist (N)", !!p && /Neu laden\|Einstellungen\|Bearbeiten\|Offline \(\d+\)\|Verwaist \(0\)/.test(svcBtns), svcBtns);
  await c.shot(resolve(OUT, "p5-service-panel.png"));
  await tap(".popup .qchip", "^Bearbeiten$", 700);
  check("Bearbeiten: blaue Leiste 'Bearbeiten · Fertig'", /Bearbeiten/.test((await text(".editbar")) || "") && /Fertig/.test((await text(".editbar__btn")) || ""));
  await tap(".rail__item", "Küche", 600);
  const callsBefore = (await serviceCalls()).length;
  const klima = await c.center('[data-zone="kueche"] [data-id="climate.klima"]');
  await c.tap(klima.l + 30, klima.y); // icon zone: would switch outside the edit mode
  await sleep(600);
  p = await popup();
  check("Tipp aufs Icon im Bearbeiten-Modus öffnet das Blatt, schaltet nichts", !!p && /^Bearbeiten, Küche$/.test(p.state) && (await serviceCalls()).length === callsBefore, JSON.stringify(p));
  check("Blatt: Stufe ★ Start · Zone · Nur Alle · Ausblenden, Zone 5 + keine, ◀ ▶, Zurücksetzen, <= 680 ohne Scrollen",
    (await c.eval(`Array.prototype.map.call(document.querySelectorAll('.popup .seg > div'), (e) => e.textContent).join('|')`)) === "Start|Zone|Nur Alle|Ausblenden" &&
      (await c.eval(`document.querySelectorAll('.popup .qchips--3 .qchip').length`)) === 6 && p.h <= 680 && p.over <= 0, `${p.h} px`);
  await c.shot(resolve(OUT, "p5-bearbeiten-blatt.png"));
  const typed = await typeName("Klimaanlage123456");
  check("Name: Feld lässt höchstens 14 Zeichen zu, Zähler 14/14", typed.length === 14 && (await text(".popup .ename__n")) === "14/14", `${typed} (${typed.length})`);
  const r422 = await c.eval(`fetch('/api/zones/items/climate.klima', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'x'.repeat(15) }) }).then((r) => r.status)`);
  check("Backend lehnt 15 Zeichen mit 422 ab", r422 === 422, String(r422));
  await typeName("Klimagerät");
  await tap(".popup .ename .pbtn", null, 900);
  const named = await c.eval(`document.querySelector('[data-zone="kueche"] [data-id="climate.klima"] .tile__name').textContent`);
  check("Umbenennen auf 'Klimagerät' wirkt sofort auf der Kachel", named === "Klimagerät" && (await board()).items["climate.klima"].name === "Klimagerät", named);
  // order: Decke ▶ (after Arbeitslicht) inside the Licht section
  await closePopup();
  const sec0 = (await board()).zones.filter((z) => z.id === "kueche")[0].sections[0].items.slice();
  await tap('[data-zone="kueche"] [data-id="light.alex_wohnung_kuchendeckenlicht"]', null, 600);
  await tap(".popup .qchip", "später", 900);
  const sec1 = (await board()).zones.filter((z) => z.id === "kueche")[0].sections[0].items;
  check("Reihenfolge ▶ tauscht im Abschnitt (Decke nach Arbeitslicht)", sec0[0] === "light.alex_wohnung_kuchendeckenlicht" && sec1[1] === "light.alex_wohnung_kuchendeckenlicht" && sec1[0] === sec0[1], `${sec0.join(",")} -> ${sec1.join(",")}`);
  await closePopup();
  // hide -> gone from the zone -> back via "Ausgeblendet"
  await tap('[data-zone="kueche"] [data-id="climate.klima"]', null, 600);
  await tap(".popup .seg > div", "^Ausblenden$", 900);
  await closePopup();
  check("Ausblenden: Kachel weg aus Küche", !(await tileIn("kueche", "climate.klima")));
  await tap(".rail__item", "Alle$", 600);
  await tap(".fchip", "^Ausgeblendet", 500);
  check("Filter 'Ausgeblendet' (nur im Bearbeiten-Modus) zeigt die Kachel", !!(await c.center('.alle__list [data-id="climate.klima"]')));
  await c.shot(resolve(OUT, "p5-ausgeblendet.png"));
  await tap('.alle__list [data-id="climate.klima"]', null, 600);
  await tap(".popup .seg > div", "^Zone$", 900);
  await closePopup();
  await tap(".rail__item", "Küche", 600);
  check("Zurückgeholt: Kachel wieder in Küche", await tileIn("kueche", "climate.klima"));
  // favourites: start full, rename a favourite tile
  await tap('[data-zone="kueche"] [data-id="climate.klima"]', null, 600);
  await tap(".popup .seg > div", "Start", 600);
  check("★ Start bei 15 Favoriten: 'Start ist voll (15)'", /Start ist voll \(15\)/.test((await text(".popup .popup__foot")) || ""));
  await closePopup();
  await tap(".rail__item", "Start$", 700);
  await tap('.start-left .grid3:not(.grid3--kg) [data-id="light.zone_kueche"]', null, 600);
  p = await popup();
  check("Favorit im Bearbeiten-Modus: Blatt 'Bearbeiten, Start'", !!p && p.state === "Bearbeiten, Start", JSON.stringify(p));
  await typeName("Kochen");
  await tap(".popup .ename .pbtn", null, 900);
  const favName = await c.eval(`document.querySelector('.start-left .grid3:not(.grid3--kg) [data-id="light.zone_kueche"] .tile__name').textContent`);
  const b3 = await board();
  check("Favorit umbenannt ('Kochen'), Gruppe heißt weiter 'Küche'", favName === "Kochen" && b3.items["light.zone_kueche"].name === "Küche", favName);
  const favOrder0 = b3.start.favorites.map((f) => f.id);
  await tap(".popup .qchip", "später", 900);
  const favOrder1 = (await board()).start.favorites.map((f) => f.id);
  check("◀ ▶ im Favoriten-Kontext verschiebt den Favoriten", favOrder1.indexOf("light.zone_kueche") === favOrder0.indexOf("light.zone_kueche") + 1);
  await closePopup();
  const names = await c.eval(NAME_CHECK);
  check("Start: kein abgeschnittener Name nach den Änderungen", names.bad.length === 0, `${names.checked} geprüft ${names.bad.join(" | ")}`);
  await tap(".editbar__btn", null, 600);
  check("Fertig beendet den Bearbeiten-Modus", (await c.eval(`!document.querySelector('.editbar') && !document.querySelector('.stage.is-editing')`)));
  check("Bearbeiten und Eingangskorb rufen keinen HA-Dienst auf", (await serviceCalls()).length === calls0, JSON.stringify(await serviceCalls()));

  // ---- Einstellungen ------------------------------------------------------------------------
  await tap(".rail__item", "System", 600);
  await tap(".popup .qchip", "^Einstellungen$", 700);
  p = await popup();
  check("Einstellungen ohne Scrollen, Nachtfenster + 'Nachts gedimmt einschalten' Aus/10/15/25", !!p && p.over <= 0 && p.h <= 680 &&
    (await c.eval(`Array.prototype.map.call(document.querySelectorAll('.popup .qchip'), (e) => e.textContent).join('|')`)) === "Aus|10 %|15 %|25 %", JSON.stringify(p));
  check("Entfallen: Stärke, Übergang, Dunkles Design, Schoner, Kiosk", !(await c.eval(`/Stärke|Übergang|Dunkles|Bildschirmschoner|Kiosk-Modus/.test(document.querySelector('.popup').textContent)`)));
  await c.shot(resolve(OUT, "p5-einstellungen.png"));
  await tap(".popup .qchip", "^25 %$", 900);
  const docs = await api("/api/dashboards");
  check("'Nachts gedimmt' 25 % gespeichert in meta.settings.nightOnPct", docs[0].meta.settings.nightOnPct === 25, JSON.stringify(docs[0].meta.settings));
  await tap(".popup .pbtn", "Warnmeldung", 500);
  p = await popup();
  check("Warnmeldung-Helfer eingeklappt in eigener Ansicht, 6 Felder, ohne Scrollen", !!p && p.over <= 0 && (await c.eval(`document.querySelectorAll('.popup .dlg__input').length`)) === 6, JSON.stringify(p));
  await closePopup();
  // Offline (N) -> Alle/Offline
  await tap(".rail__item", "System", 600);
  await tap(".popup .qchip", "^Offline", 700);
  check("Offline (N) öffnet Alle mit Filter Offline", (await c.eval(`document.querySelector('.alle') && document.querySelector('.alle').getAttribute('data-tab')`)) === "offline" &&
    !!(await c.center('.alle__list [data-id="switch.alex_wohnung_fernseher_bett"]')));

  const errs = c.logs.filter((l) => l.startsWith("exception") || l.startsWith("error"));
  check("keine JS-Fehler", errs.length === 0, errs.slice(0, 5).join(" | "));
} finally {
  c.close();
  await stopServer();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} bestanden (Daten: ${DATA})`);
process.exit(failed ? 1 : 0);
