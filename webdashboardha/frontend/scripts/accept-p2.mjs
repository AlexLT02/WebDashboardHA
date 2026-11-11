// P2 acceptance against the mock (04 §6 P2): touch gestures via CDP, call protocol,
// "keine Kachel ohne Wirkung", name check for all zones.
// Requires the mock server: npx vite --config vite.mock.config.mts
import { calls, clearCalls, launch, mock, MOCK, NAME_CHECK, sleep } from "./cdp.mjs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
};
const svc = (cs) => cs.filter((c) => c.domain !== "zones");
const popupOpen = (c) => c.eval(`!!document.querySelector('.scrim:not(.is-closing) .popup')`);

const c = await launch();
const NOW = "2026-11-11T14:12:00";
try {
  await mock("/__mock/scenario", { name: "mockup-day" });
  await c.goto(`${MOCK}/?screen=zone:wohnbereich&now=${NOW}`, 2500);

  const tile = (id) => c.center(`.tile[data-id="${id}"]`);
  const eingang = await tile("light.alex_wohnung_eingangsbereich");

  // 1. Icon tap -> exactly one service call, no popup
  await clearCalls();
  await c.tap(eingang.l + 30, eingang.y);
  await sleep(500);
  let cs = svc(await calls());
  check("Icon-Tipp ruft genau einen Dienst", cs.length === 1 && cs[0].domain === "light" && cs[0].entity_id === "light.alex_wohnung_eingangsbereich",
    JSON.stringify(cs.map((x) => `${x.domain}.${x.service} ${x.entity_id}`)));
  check("Icon-Tipp öffnet kein Popup", !(await popupOpen(c)));
  const pendingSeen = await c.eval(`document.querySelector('.tile[data-id="light.alex_wohnung_eingangsbereich"]').className`);
  await sleep(600);

  // 2. Body tap -> popup, no service call
  await clearCalls();
  const decke = await tile("light.alex_wohnung_wohnbereich_links");
  await c.tap(decke.l + decke.w - 30, decke.y);
  await sleep(450);
  cs = svc(await calls());
  check("Flächen-Tipp öffnet Popup", await popupOpen(c));
  check("Flächen-Tipp ruft keinen Dienst", cs.length === 0, JSON.stringify(cs));
  // Scrim tap closes (after the 350 ms backdrop delay)
  await c.tap(60, 700);
  await sleep(400);
  check("Tipp neben das Popup schließt es", !(await popupOpen(c)));
  check("Tipp neben das Popup schaltet nichts", svc(await calls()).length === 0);
  await sleep(400);

  // 3. Hold 0.5 s -> popup; released -> stays open; no call
  await clearCalls();
  const sofa = await tile("light.alex_wohnung_sofa_links");
  await c.touch("touchStart", [{ x: sofa.l + 30, y: sofa.y }]);
  await sleep(700);
  const openWhileHolding = await popupOpen(c);
  await c.touch("touchEnd", []);
  await sleep(600);
  check("Halten 0,5 s öffnet Popup (auch auf dem Icon)", openWhileHolding);
  check("Popup per Halten bleibt nach dem Loslassen offen", await popupOpen(c));
  check("Halten ruft keinen Dienst", svc(await calls()).length === 0, JSON.stringify(svc(await calls())));
  const x = await c.center(".popup__x");
  await c.tap(x.x, x.y);
  await sleep(500);
  check("✕ schließt", !(await popupOpen(c)));

  // 4. Swipe 40 px over tiles -> nothing
  await clearCalls();
  await c.swipe(eingang.l + 30, eingang.y, 40, 0);
  await sleep(300);
  await c.swipe(decke.l + 30, decke.y + 10, 0, -40);
  await sleep(500);
  check("Wischen 40 px schaltet nichts", svc(await calls()).length === 0, JSON.stringify(svc(await calls())));
  check("Wischen öffnet kein Popup", !(await popupOpen(c)));

  // 6. Same target twice within 350 ms -> one call
  await clearCalls();
  const ecke = await tile("light.ambiente_ecklampe");
  await c.tap(ecke.l + 30, ecke.y, 40);
  await sleep(120);
  await c.tap(ecke.l + 30, ecke.y, 40);
  await sleep(600);
  check("Doppeltipp < 350 ms schaltet einmal", svc(await calls()).length === 1, String(svc(await calls()).length));
  await sleep(600);

  // 7. Inline cover buttons
  await clearCalls();
  const up = await c.center(`.tile[data-id="cover.rolladen_treppe_alex_wohnung"] .cbtn`);
  await c.tap(up.x, up.y);
  await sleep(500);
  cs = svc(await calls());
  check("Rollladen ▲ ruft cover.open_cover", cs.length === 1 && cs[0].service === "open_cover", JSON.stringify(cs.map((q) => q.service)));
  check("Rollladen ▲ öffnet kein Popup", !(await popupOpen(c)));
  await sleep(500);

  // 8. Chip badge -> one bulk action (group on/off)
  await clearCalls();
  const chip = await c.center(`.chip[data-id="light.zone_sofa_deckenlicht"]`);
  await c.tap(chip.l + 20, chip.y);
  await sleep(500);
  cs = svc(await calls());
  check("Chip-Badge schaltet die Gruppe", cs.length === 1 && cs[0].via === "actions/on:group", JSON.stringify(cs.map((q) => `${q.via} ${q.domain}.${q.service} ${q.entity_id}`)));
  await sleep(600);

  // 9. Zone "Licht aus N" -> actions/off zone (scene.create + light.turn_off)
  await clearCalls();
  const off = await c.center(".zone__off");
  await c.tap(off.x, off.y);
  await sleep(600);
  cs = svc(await calls());
  const created = cs.filter((q) => q.domain === "scene" && q.service === "create")[0];
  check("Licht aus N: Snapshot ohne Gruppen, dann light.turn_off", !!created && cs.some((q) => q.domain === "light" && q.service === "turn_off") &&
    !created.data.snapshot_entities.some((e) => e.indexOf("light.zone_") === 0), JSON.stringify(cs.map((q) => `${q.domain}.${q.service}`)));
  await sleep(500);

  // 10. Critical socket (inbox, screen Alle): tap on = on, short tap when on = hint, hold 1 s = off
  await mock("/__mock/scenario", { name: "mockup-day" });
  await c.goto(`${MOCK}/?screen=alle&now=${NOW}`, 2500);
  await clearCalls();
  await c.eval(`document.querySelector('.tile[data-id="switch.switch_alex_steckdose_1"]').scrollIntoView({ block: 'center' })`);
  await sleep(300); // scroll guard: taps < 150 ms after a scroll do not count
  const lan = await c.center(`.tile[data-id="switch.switch_alex_steckdose_1"]`);
  const target = lan && lan.y > 30 && lan.y < 740 ? lan : null;
  if (target) {
    await c.tap(target.l + 30, target.y);
    await sleep(700);
    cs = svc(await calls());
    check("Kritische Steckdose: Tipp schaltet ein", cs.length === 1 && cs[0].service === "turn_on", JSON.stringify(cs.map((q) => q.service)));
    await clearCalls();
    await sleep(500);
    await c.tap(target.l + 30, target.y, 80);
    await sleep(200);
    const hint = await c.eval(`document.querySelector('.tile[data-id="switch.switch_alex_steckdose_1"] .tile__sub').textContent`);
    check("Kritisch an: kurzer Tipp zeigt 'Zum Aus 1 s halten', kein Aufruf", hint === "Zum Aus 1 s halten" && svc(await calls()).length === 0, hint);
    await sleep(500);
    await c.touch("touchStart", [{ x: target.l + 30, y: target.y }]);
    await sleep(500);
    const during = await c.eval(`document.querySelector('.tile[data-id="switch.switch_alex_steckdose_1"]').className`);
    await sleep(650);
    await c.touch("touchEnd", []);
    await sleep(500);
    cs = svc(await calls());
    check("Kritisch an: Halten 1 s schaltet aus", cs.length === 1 && cs[0].service === "turn_off", JSON.stringify(cs.map((q) => q.service)) + " während: " + during);
    check("Halten auf kritischem Icon öffnet kein Popup", !(await popupOpen(c)));
  } else check("Kritische Steckdose sichtbar", false, JSON.stringify(lan));

  // 11. Every tile in every zone: body tap opens a popup (no dead tiles); names fit
  const board = await (await fetch(`${MOCK}/api/board`)).json();
  let dead = [];
  let tiles = 0;
  const nameBad = [];
  for (const z of board.zones) {
    await mock("/__mock/scenario", { name: "base" });
    await c.goto(`${MOCK}/?screen=zone:${z.id}&now=${NOW}`, 1800);
    const nc = await c.eval(NAME_CHECK);
    nameBad.push(...nc.bad.map((b) => `${z.id}: ${b}`));
    const ids = await c.eval(`Array.prototype.map.call(document.querySelectorAll('.zone .tile, .zone .chip'), (e) => e.getAttribute('data-id'))`);
    for (const id of ids) {
      tiles++;
      const sel = `[data-id="${id}"]`;
      const moved = await c.eval(`(() => { const z = document.querySelector('.zone'); const t = z.scrollTop;
        document.querySelector('${sel}').scrollIntoView({ block: 'nearest' }); return z.scrollTop !== t; })()`);
      if (moved) await sleep(250); // scroll guard
      const r = await c.center(sel);
      const isCover = await c.eval(`document.querySelector('${sel}').classList.contains('tile--cover')`);
      const bx = isCover ? r.l + 120 : r.l + r.w - 24;
      await c.tap(bx, r.y);
      await sleep(420);
      if (!(await popupOpen(c))) dead.push(`${z.id}/${id}`);
      else {
        const px = await c.center(".popup__x");
        await c.tap(px.x, px.y);
        await sleep(420);
      }
    }
  }
  check(`Alle Zonen: jede Kachel/jeder Chip öffnet ein Popup (${tiles})`, dead.length === 0, dead.join(", "));
  check("Alle Zonen: kein abgeschnittener Name (8 % Reserve)", nameBad.length === 0, nameBad.join(" | "));
  const boardStatus = await (await fetch(`${MOCK}/api/board`)).json();
  check("board.orphans leer", boardStatus.orphans.length === 0);

  // 12. Optimistic feedback: immediate target, "Keine Rückmeldung" after 5 s, "Fehlgeschlagen" on HTTP error
  const sub = (id) => c.eval(`(() => { const t = document.querySelector('.tile[data-id="${id}"]'); return t.className + ' | ' + t.querySelector('.tile__sub').textContent; })()`);
  await mock("/__mock/scenario", { name: "mockup-day" });
  await c.goto(`${MOCK}/?screen=zone:wohnbereich&now=${NOW}`, 2000);
  await mock("/__mock/config", { noresp: true });
  const dl = await tile("light.alex_wohnung_wohnbereich_links");
  const t0 = Date.now();
  await c.touch("touchStart", [{ x: dl.l + 30, y: dl.y }]);
  const pressed = await c.eval(`document.querySelector('.tile[data-id="light.alex_wohnung_wohnbereich_links"] .badge').className`);
  await c.touch("touchEnd", []);
  const after = await sub("light.alex_wohnung_wohnbereich_links");
  const dt = Date.now() - t0;
  check("touchstart: Badge sofort gedrückt (is-press)", /is-press/.test(pressed), pressed);
  check(`Sofortbild nach touchend (${dt} ms inkl. CDP)`, /is-on/.test(after) && /is-pending/.test(after) && /Schaltet ein/.test(after), after);
  await sleep(5300);
  const nr = await sub("light.alex_wohnung_wohnbereich_links");
  check("Keine Rückmeldung nach 5 s, zurück auf HA-Stand", /is-noresp/.test(nr) && !/is-on/.test(nr) && /Keine Rückmeldung/.test(nr), nr);
  await sleep(4200);
  check("nach 4 s wieder normale Statuszeile", /\| Aus$/.test(await sub("light.alex_wohnung_wohnbereich_links")), await sub("light.alex_wohnung_wohnbereich_links"));
  await mock("/__mock/config", { noresp: false, fail: true });
  await c.tap(dl.l + 30, dl.y);
  await sleep(250);
  const fl = await sub("light.alex_wohnung_wohnbereich_links");
  check("HTTP-Fehler: sofort zurück, roter Rand, Fehlgeschlagen", /is-failed/.test(fl) && /is-flash/.test(fl) && !/is-on/.test(fl) && /Fehlgeschlagen/.test(fl), fl);
  await mock("/__mock/config", { fail: false });
  await sleep(800);

  // 13. Door opens -> back to Start at once
  await mock("/__mock/state", { entity_id: "binary_sensor.alex_wohnung_einganstur_tur", state: "on" });
  await sleep(600);
  check("Tür auf: sofort zurück auf Start", await c.eval(`!document.querySelector('.zone') && !!document.querySelector('.start-left')`));
  await mock("/__mock/state", { entity_id: "binary_sensor.alex_wohnung_einganstur_tur", state: "off" });

  // 14. 60 s without touch -> Start, popup closed (popup itself closes after 30 s)
  await c.goto(`${MOCK}/?screen=zone:bad&now=${NOW}`, 2000);
  const bt = await c.center(`.zone .tile`);
  await c.tap(bt.l + bt.w - 24, bt.y);
  await sleep(500);
  const popupBefore = await popupOpen(c);
  await sleep(30500);
  const popupAfter30 = await popupOpen(c);
  const zoneAfter30 = await c.eval(`!!document.querySelector('.zone')`);
  await sleep(30500);
  check("Popup schließt nach 30 s Ruhe", popupBefore && !popupAfter30 && zoneAfter30);
  check("60 s ohne Berührung: zurück auf Start", await c.eval(`!document.querySelector('.zone') && !!document.querySelector('.start-left')`));

  // 5. Two fingers -> nothing (last: CDP multi-touch can disturb later sequences)
  await mock("/__mock/scenario", { name: "mockup-day" });
  await c.goto(`${MOCK}/?screen=zone:wohnbereich&now=${NOW}`, 2000);
  await c.eval(`window.__tc = 0; document.addEventListener('touchstart', () => window.__tc++, true); 1`);
  await clearCalls();
  const e2 = await tile("light.alex_wohnung_eingangsbereich");
  await c.twoFinger(e2.l + 30, e2.y);
  await sleep(500);
  check("Zwei-Finger-Tipp kam als Touch an", (await c.eval("window.__tc")) >= 1);
  check("Zwei-Finger-Tipp schaltet nichts", svc(await calls()).length === 0, JSON.stringify(svc(await calls())));
  check("Zwei-Finger-Tipp öffnet kein Popup", !(await popupOpen(c)));
  if (c.logs.filter((l) => l.startsWith("exception") || l.startsWith("error")).length) {
    check("keine JS-Fehler", false, c.logs.filter((l) => l.startsWith("exception") || l.startsWith("error")).slice(0, 5).join(" | "));
  } else check("keine JS-Fehler", true);
  void pendingSeen;
} finally {
  c.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} bestanden`);
process.exit(failed ? 1 : 0);
