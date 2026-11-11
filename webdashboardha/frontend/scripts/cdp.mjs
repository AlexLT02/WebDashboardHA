// Minimal CDP harness: own headless Chrome (separate profile), 1024 x 768 @2x,
// touch emulation, screenshots. Node 22 has fetch + WebSocket built in.
// Not part of the add-on build; used for the P2+ acceptance runs against the mock.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ width = 1024, height = 768, scale = 2, touch = true } = {}) {
  const port = 9400 + Math.floor(Math.random() * 400);
  const prof = resolve(tmpdir(), `wdh-cdp-${port}`);
  mkdirSync(prof, { recursive: true });
  const proc = spawn(
    CHROME,
    ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, "about:blank"],
    { stdio: "ignore" },
  );
  let targets;
  for (let i = 0; i < 80; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      if (targets.find((t) => t.type === "page")) break;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    } else if (m.method) listeners.forEach((l) => l(m));
  });
  const send = (method, params = {}) =>
    new Promise((r) => {
      const i = ++id;
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false });
  if (touch) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  const logs = [];
  listeners.push((m) => {
    if (m.method === "Runtime.consoleAPICalled") logs.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(" ")}`);
    if (m.method === "Runtime.exceptionThrown") logs.push(`exception: ${m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text}`);
  });

  const api = {
    send,
    logs,
    async goto(url, waitMs = 1500) {
      await send("Page.navigate", { url });
      await sleep(waitMs);
      // After a multi-touch sequence plus navigation, Chrome delivers later CDP
      // touches as mouse events; re-arming the emulation per page avoids that.
      if (touch) await api.resetTouch();
    },
    async eval(expr) {
      const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || "eval failed");
      return r.result?.result?.value;
    },
    async shot(file) {
      const s = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(file, Buffer.from(s.result.data, "base64"));
      return file;
    },
    async touch(type, points) {
      const r = await send("Input.dispatchTouchEvent", {
        type,
        touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i, radiusX: 4, radiusY: 4, force: 1 })),
      });
      if (r.error) console.log(`touch ${type} error: ${JSON.stringify(r.error)}`);
      return r;
    },
    /** Tap: down, hold `ms`, up. */
    async tap(x, y, ms = 60) {
      await api.touch("touchStart", [{ x, y }]);
      await sleep(ms);
      await api.touch("touchEnd", []);
    },
    /** Swipe from (x,y) by (dx,dy) in `steps`. */
    async swipe(x, y, dx, dy, steps = 8, stepMs = 16) {
      await api.touch("touchStart", [{ x, y }]);
      for (let i = 1; i <= steps; i++) {
        await sleep(stepMs);
        await api.touch("touchMove", [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps }]);
      }
      await api.touch("touchEnd", []);
    },
    async twoFinger(x, y) {
      // Note: in long CDP sessions Chrome sometimes delivers later touches as
      // synthesized mouse events after a multi-touch sequence; run it last.
      await api.touch("touchStart", [{ x, y, id: 0 }, { x: x + 40, y: y + 10, id: 1 }]);
      await sleep(60);
      await api.touch("touchEnd", []);
    },
    /** Re-arm touch emulation (clears stale points of multi-touch sequences). */
    async resetTouch() {
      await send("Emulation.setTouchEmulationEnabled", { enabled: false });
      await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    },
    /** Centre of the first element matching a CSS selector (CSS px). */
    async center(selector) {
      return api.eval(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null;
        const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, t: r.top, w: r.width, h: r.height }; })()`);
    },
    close() {
      ws.close();
      proc.kill();
    },
  };
  return api;
}

export const MOCK = process.env.MOCK || "http://localhost:5199";

export async function mock(path, body, method = "POST") {
  const r = await fetch(MOCK + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

export async function calls() {
  return (await fetch(MOCK + "/__mock/calls")).json();
}
export async function clearCalls() {
  await fetch(MOCK + "/__mock/calls", { method: "DELETE" });
}

/**
 * 04 §7: every .tile__name, .chip__name, .rail__label must fit with 8 % reserve
 * (San Francisco runs wider than Segoe UI). scrollWidth is never below
 * clientWidth, so the text width is measured with a Range (glyph extent);
 * shrink-to-fit elements (chip names) are measured against their max-width.
 */
export const NAME_CHECK = `(() => {
  const bad = [];
  let n = 0, worst = 0;
  for (const sel of ['.tile__name', '.chip__name', '.rail__label']) {
    for (const e of document.querySelectorAll(sel)) {
      if (!e.offsetParent) continue;
      n++;
      const r = document.createRange();
      r.selectNodeContents(e);
      const text = r.getBoundingClientRect().width;
      const mw = parseFloat(getComputedStyle(e).maxWidth);
      const avail = isFinite(mw) ? mw : e.clientWidth;
      const ratio = text / avail;
      if (ratio > worst) worst = ratio;
      if (e.scrollWidth > e.clientWidth || ratio > 0.92) bad.push(sel + ' "' + e.textContent + '" ' + Math.round(text) + '/' + Math.round(avail));
    }
  }
  return { checked: n, worst: Math.round(worst * 1000) / 1000, bad };
})()`;
