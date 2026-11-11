// Render deep links of the mock to PNG (1024 x 768 @2x) and run the name check.
// Usage: node scripts/render.mjs <out-dir> <scenario> <name>=<query> [<name>=<query> ...]
//   e.g. node scripts/render.mjs ../../docs/konzept-v2/abnahme mockup-day p2-zone-wohnbereich="screen=zone:wohnbereich&now=2026-11-11T14:12:00"
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { launch, mock, MOCK, NAME_CHECK, sleep } from "./cdp.mjs";

const [outDir, scenario, ...shots] = process.argv.slice(2);
if (!outDir || !scenario || !shots.length) {
  console.error("usage: node scripts/render.mjs <out-dir> <scenario> name=query ...");
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });
const chrome = await launch();
try {
  for (const spec of shots) {
    const i = spec.indexOf("=");
    const name = spec.slice(0, i);
    const query = spec.slice(i + 1);
    await mock("/__mock/scenario", { name: scenario });
    await chrome.goto(`${MOCK}/?${query}`, 2200);
    if (process.env.PREP) await chrome.eval(process.env.PREP);
    await sleep(Number(process.env.WAIT || 300));
    const file = await chrome.shot(resolve(outDir, `${name}.png`));
    const names = await chrome.eval(NAME_CHECK);
    const height = await chrome.eval(`(() => { const p = document.querySelector('.popup'); const z = document.querySelector('.zone');
      return { popup: p ? Math.round(p.getBoundingClientRect().height) : null, popupTop: p ? Math.round(p.getBoundingClientRect().top) : null,
        zoneScroll: z ? z.scrollHeight - z.clientHeight : null, nodes: document.getElementsByTagName('*').length }; })()`);
    console.log(JSON.stringify({ file, names, ...height }));
  }
  if (chrome.logs.length) console.log("console:", chrome.logs.slice(0, 20).join("\n"));
} finally {
  chrome.close();
}
