// P6 acceptance against the mock (04 §6 P6): night shade swallows the first touch,
// D14 (lights at 15 % at night), door wakes without swallowing, hint banner vs.
// full-screen warning, connection stages (amber after 3 s, stale after 30 s:
// "Offline, nichts gesendet" and no call, then 1 s "Verbunden").
// Starts the mock server itself (npx vite --config vite.mock.config.mts).
//   node scripts/accept-p6.mjs [out-dir]
import { spawn, execSync } from "node:child_process";
import { resolve } from "node:path";
import { calls, clearCalls, launch, mock, MOCK, sleep } from "./cdp.mjs";

const OUT = process.argv[2] || resolve("../../docs/konzept-v2/abnahme");
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
};

const server = spawn("npx", ["vite", "--config", "vite.mock.config.mts"], { shell: true, stdio: "ignore" });
let up = false;
for (let i = 0; i < 120 && !up; i++) {
  try {
    up = (await fetch(`${MOCK}/api/board`)).ok;
  } catch {
    await sleep(500);
  }
}
if (!up) {
  console.log("FAIL  mock server did not start");
  process.exit(1);
}

const board = await (await fetch(`${MOCK}/api/board`)).json();
const settings = (night) => mock("/api/dashboards/x", { meta: { settings: { night, nightStart: "22:30", nightEnd: "06:30", nightOnPct: 15 } } }, "PUT");
const state = (entity_id, s) => mock("/__mock/state", { entity_id, state: s });
const page = await launch();
const opacity = (sel) => page.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? getComputedStyle(e).opacity + "|" + getComputedStyle(e).pointerEvents : null; })()`);
const offLight = () =>
  page.eval(`(() => { const t = [].slice.call(document.querySelectorAll('.tile[data-id^="light."]')).filter(e => !e.classList.contains('is-on'))[0];
    if (!t) return null; const r = t.querySelector('.badge').getBoundingClientRect(); return { id: t.getAttribute('data-id'), x: r.left + 20, y: r.top + 20 }; })()`);

try {
  await mock("/__mock/scenario", { name: "mockup-day" });
  // ---- night ----
  await settings(true);
  await page.goto(`${MOCK}/?screen=start&now=2026-11-12T01:29:00`, 2500);
  check("Nacht: Schlaf-Ebene deckt, fängt Berührungen", (await opacity(".night--sleep")) === "1|auto", await opacity(".night--sleep"));
  await page.shot(resolve(OUT, "p6-start-nacht.png"));
  const l = await offLight();
  await clearCalls();
  await page.tap(l.x, l.y);
  await sleep(700);
  const c1 = await calls();
  check("Nacht: erste Berührung ruft keinen Dienst", c1.length === 0, `${c1.length} Aufrufe`);
  check("Nacht: danach Wach-Ebene 35 %", (await opacity(".night--wake")) === "1|none" && (await opacity(".night--sleep")).indexOf("auto") < 0);
  await page.tap(l.x, l.y);
  await sleep(700);
  const c2 = await calls();
  const on = c2.filter((c) => c.service === "turn_on")[0];
  check("Nacht: zweite Berührung schaltet", c2.length === 1, JSON.stringify(c2).slice(0, 140));
  check("D14: Licht geht nachts mit 15 % an", !!on && on.data && on.data.brightness_pct === 15, l.id);
  await state(l.id, "off");
  console.log("…  warte 34 s, bis die Nacht wieder schläft");
  await sleep(34000);
  check("Nacht: nach 30 s wieder Schlaf-Ebene", (await opacity(".night--sleep")) === "1|auto");
  await state(board.door_reset, "off");
  await sleep(300);
  await state(board.door_reset, "on");
  await sleep(1200);
  check("Tür öffnet nachts: wach ohne Schlucken", (await opacity(".night--wake")) === "1|none", board.door_reset);
  await page.goto(`${MOCK}/?screen=start&now=2026-11-12T01:29:00`, 2500);
  await state(board.door_reset, "off");
  await sleep(300);
  await state(board.door_reset, "on");
  await sleep(1200);
  const l2 = await offLight();
  await clearCalls();
  await page.tap(l2.x, l2.y);
  await sleep(700);
  check("Tür wach: erste Berührung schaltet sofort", (await calls()).length === 1);
  await state(board.door_reset, "off");

  // ---- banner / full screen ----
  await settings(false);
  await mock("/__mock/scenario", { name: "mockup-day" });
  await page.goto(`${MOCK}/?screen=start&now=2026-11-12T12:00:00`, 2500);
  await state("input_text.wdh_slot_1", "x|hinweis|Wäsche ist fertig");
  await state("input_boolean.dashboard_alert", "on");
  await sleep(800);
  const ban = await page.center(".wban");
  check("Hinweis → Banner x 112, y 24, 896 × 64", !!ban && ban.l === 112 && ban.t === 24 && ban.w === 896 && ban.h === 64, JSON.stringify(ban));
  check("Hinweis: kein Vollbild", (await page.center(".wov")) === null);
  const l3 = await offLight();
  await clearCalls();
  await page.tap(l3.x, l3.y);
  await sleep(700);
  check("Unter dem Banner bedienbar", (await calls()).length === 1);
  await state(l3.id, "off");
  await state("input_text.wdh_slot_1", "x|warnung|Kühlschrank offen");
  await sleep(800);
  check("Warnung → Vollbild, kein Banner", (await page.center(".wov")) !== null && (await page.center(".wban")) === null);
  await state("input_boolean.dashboard_alert", "off");
  await state("input_text.wdh_slot_1", "");

  // ---- connection ----
  await page.goto(`${MOCK}/?screen=start&now=2026-11-12T12:00:00`, 2500);
  await mock("/__mock/drop", { seconds: 36 });
  await sleep(4000);
  const amber = await page.eval(`(document.querySelector('.undo--conn') || {}).textContent || ''`);
  check("Nach 3 s: Bernstein-Leiste", amber.indexOf("Verbindung wird wiederhergestellt") === 0, amber);
  await sleep(28000);
  check("Nach 30 s: Klasse is-stale", await page.eval(`document.querySelector('.stage').classList.contains('is-stale')`));
  const l4 = await offLight();
  await clearCalls();
  await page.tap(l4.x, l4.y);
  await sleep(400);
  const txt = await page.eval(`(document.querySelector('.undo') || {}).textContent || ''`);
  check("Offline: Tipp → 'Offline, nichts gesendet'", txt.indexOf("Offline, nichts gesendet") === 0, txt);
  check("Offline: kein Aufruf, keine Warteschlange", (await calls()).length === 0);
  let ok = false;
  for (let i = 0; i < 160 && !ok; i++) {
    ok = await page.eval(`((document.querySelector('.undo--ok') || {}).textContent || '') === 'Verbunden'`);
    if (!ok) await sleep(200);
  }
  check("Wieder da: 1 s 'Verbunden'", ok);
  await sleep(1500);
  check("Wieder da: is-stale weg", !(await page.eval(`document.querySelector('.stage').classList.contains('is-stale')`)));
  await sleep(1000);
  check("Keine Warteschlange nach dem Wiederverbinden", (await calls()).length === 0);
  const errs = page.logs.filter((x) => x.indexOf("exception") === 0);
  check("keine JS-Fehler", errs.length === 0, errs.join(" | ").slice(0, 200));
} catch (e) {
  check("Ablauf", false, String(e && e.stack || e).slice(0, 300));
} finally {
  page.close();
  try {
    execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: "ignore" });
  } catch {
    server.kill();
  }
}
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} PASS`);
process.exit(failed ? 1 : 0);
