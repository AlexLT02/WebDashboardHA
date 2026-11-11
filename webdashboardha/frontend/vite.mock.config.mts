// Local UI test WITHOUT HA: serves the v2 backend contract from fixtures.
//   npx vite --config vite.mock.config.mts   ->  http://localhost:5199
// Fixtures: mock/board.json + states.json + hints.json (backend/tests/make_frontend_mock.py),
// optional scenarios mock/scenarios/<name>.json (state overrides for renders).
// Test hooks (only here, never in the add-on):
//   GET  /__mock/calls       call protocol (service calls incl. those of /api/actions/*)
//   DELETE /__mock/calls     clear it
//   POST /__mock/scenario    {"name": "mockup-day"} reset states + apply scenario
//   POST /__mock/config      {"delayMs":250,"noresp":false,"fail":false,"haDown":false}
//   POST /__mock/state       {"entity_id": "...", "state": "on", "attributes": {...}}
//   POST /__mock/drop        {"seconds": 10} close WebSockets and refuse reconnects
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Socket } from "node:net";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

type State = { entity_id: string; state: string; attributes: Record<string, any>; lc_ts?: number | null; finishes_ts?: number | null };
type Call = { seq: number; t: number; domain: string; service: string; entity_id?: any; data?: any; via: string };

const MOCK = resolve(__dirname, "mock");
const read = (f: string) => JSON.parse(readFileSync(resolve(MOCK, f), "utf-8"));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const BASE_BOARD = read("board.json");
const BASE_STATES: Record<string, State> = read("states.json");
const HINTS = existsSync(resolve(MOCK, "hints.json")) ? read("hints.json") : { alles_aus_covered: [] };

let board: any = clone(BASE_BOARD);
let states: Record<string, State> = clone(BASE_STATES);
let calls: Call[] = [];
let seq = 0;
let rev = board.rev || 1;
let cfg = { delayMs: 250, noresp: false, fail: false, haDown: false };
let refuseUntil = 0;
let undoSlot: { token: string; deadline: number } | null = null;
let undoSeq = 0;
let sceneSnapshot: Record<string, State> = {};

const settingsDoc = {
  id: "default",
  name: "Mock",
  columns: 2,
  groups: [],
  meta: { settings: { night: false, nightStart: "22:30", nightEnd: "06:30" } },
};

// ---- WebSocket (send only; client frames are ignored) -------------------------
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const sockets = new Set<Socket>();

function wsFrame(payload: string): Buffer {
  const data = Buffer.from(payload, "utf8");
  if (data.length < 126) return Buffer.concat([Buffer.from([0x81, data.length]), data]);
  if (data.length < 65536) {
    const head = Buffer.alloc(4);
    head[0] = 0x81;
    head[1] = 126;
    head.writeUInt16BE(data.length, 2);
    return Buffer.concat([head, data]);
  }
  const head = Buffer.alloc(10);
  head[0] = 0x81;
  head[1] = 127;
  head.writeBigUInt64BE(BigInt(data.length), 2);
  return Buffer.concat([head, data]);
}

function send(sock: Socket, msg: unknown) {
  try {
    sock.write(wsFrame(JSON.stringify(msg)));
  } catch {
    sockets.delete(sock);
    sock.destroy();
  }
}
const broadcast = (msg: unknown) => sockets.forEach((s) => send(s, msg));
const boardMsg = () => ({ type: "board", rev, board: { ...board, rev } });
const snapshotMsg = () => ({ type: "snapshot", states });

// ---- state simulation ----------------------------------------------------------
const domainOf = (id: string) => id.split(".")[0];
const isGroup = (id: string) => Array.isArray(states[id]?.attributes?.entity_id);

function setState(id: string, state: string | null, attrs?: Record<string, any>, push = true) {
  const prev = states[id];
  const next: State = prev ? clone(prev) : { entity_id: id, state: "unknown", attributes: {}, lc_ts: Date.now() };
  if (state !== null && state !== next.state) {
    next.state = state;
    next.lc_ts = Date.now();
  }
  if (attrs) Object.assign(next.attributes, attrs);
  states[id] = next;
  if (push) broadcast({ type: "state", entity_id: id, state: next });
}

function refreshGroups() {
  for (const id in states) {
    if (!isGroup(id) || domainOf(id) !== "light") continue;
    const members: string[] = states[id].attributes.entity_id;
    const anyOn = members.some((m) => states[m]?.state === "on");
    if ((states[id].state === "on") !== anyOn) setState(id, anyOn ? "on" : "off");
  }
}

function lightOn(id: string, data: Record<string, any> = {}) {
  if (isGroup(id)) {
    for (const m of states[id].attributes.entity_id as string[]) lightOn(m, data);
    return;
  }
  const a: Record<string, any> = {};
  const cur = states[id]?.attributes || {};
  if (data.brightness !== undefined) a.brightness = data.brightness;
  else if (data.brightness_pct !== undefined) a.brightness = Math.round(data.brightness_pct * 2.55);
  else if (!cur.brightness && (cur.supported_color_modes || []).join() !== "onoff") a.brightness = 255;
  if (data.color_temp_kelvin !== undefined) Object.assign(a, { color_mode: "color_temp", color_temp_kelvin: data.color_temp_kelvin });
  if (data.hs_color !== undefined) Object.assign(a, { color_mode: "hs", hs_color: data.hs_color, rgb_color: undefined });
  setState(id, "on", a);
}

function lightOff(id: string) {
  if (isGroup(id)) {
    for (const m of states[id].attributes.entity_id as string[]) lightOff(m);
    return;
  }
  setState(id, "off", { brightness: null });
}

function ids(v: any): string[] {
  return v === undefined || v === null ? [] : Array.isArray(v) ? v : [v];
}

function applyService(domain: string, service: string, entity: any, data: any = {}) {
  for (const id of ids(entity)) {
    const d = domainOf(id);
    if (domain === "light" || (domain === "homeassistant" && d === "light")) {
      if (service === "turn_on") lightOn(id, data);
      else if (service === "turn_off") lightOff(id);
      else if (service === "toggle") (states[id]?.state === "on" ? lightOff : lightOn)(id, data);
    } else if (["switch", "input_boolean", "fan"].includes(domain) || (domain === "homeassistant" && ["switch", "input_boolean", "fan"].includes(d))) {
      if (service === "turn_on") setState(id, "on");
      else if (service === "turn_off") setState(id, "off");
      else if (service === "toggle") setState(id, states[id]?.state === "on" ? "off" : "on");
    } else if (domain === "media_player") {
      if (service === "turn_on") setState(id, "idle");
      else if (service === "turn_off") setState(id, "off");
      else if (service === "volume_mute") setState(id, null, { is_volume_muted: !!data.is_volume_muted });
      else if (service === "volume_set") setState(id, null, { volume_level: data.volume_level });
      else if (service === "media_play_pause") setState(id, states[id]?.state === "playing" ? "paused" : "playing");
    } else if (domain === "climate") {
      if (service === "set_temperature") setState(id, null, { temperature: data.temperature });
      else if (service === "set_hvac_mode") setState(id, data.hvac_mode);
    } else if (domain === "timer") {
      const t = clone(states[id] || { entity_id: id, state: "idle", attributes: {} });
      t.state = service === "start" ? "active" : "idle";
      t.finishes_ts = service === "start" ? Date.now() + 30 * 60000 : null;
      t.lc_ts = Date.now();
      states[id] = t;
      broadcast({ type: "state", entity_id: id, state: t });
    } else if (domain === "input_select" && service === "select_option") {
      setState(id, data.option);
    } else if (domain === "vacuum") {
      if (service === "start") setState(id, "cleaning");
      else if (service === "pause") setState(id, "paused");
      else if (service === "return_to_base") {
        setState(id, "returning");
        setTimeout(() => setState(id, "docked"), 3000);
      } else if (service === "set_fan_speed") setState(id, null, { fan_speed: data.fan_speed });
    } else if (domain === "dreame_vacuum" && service === "vacuum_clean_segment") {
      setState(id, "cleaning");
    } else if (domain === "button" && service === "press") {
      for (const vid in board.items) if (board.items[vid].unload_button === id && board.items[vid].state) setState(board.items[vid].state, "off");
    } else if (domain === "cover") {
      if (service === "open_cover" || service === "close_cover") {
        const opening = service === "open_cover";
        setState(id, opening ? "opening" : "closing");
        setTimeout(() => setState(id, opening ? "open" : "closed", opening ? undefined : undefined), 1500);
      } else if (service === "stop_cover") setState(id, "open");
      else if (service === "set_cover_position") setState(id, data.position > 0 ? "open" : "closed", { current_position: data.position });
    } else if (domain === "scene" && service === "turn_on" && id === `scene.${board.undo_scene_id || "wdh_undo"}`) {
      for (const sid in sceneSnapshot) {
        const s = sceneSnapshot[sid];
        if (s.state === "on") {
          if (domainOf(sid) === "light") lightOn(sid, { brightness: s.attributes.brightness ?? undefined });
          else setState(sid, "on");
        } else if (domainOf(sid) === "light") lightOff(sid);
        else setState(sid, "off");
      }
    }
  }
  if (domain === "scene" && service === "create") {
    sceneSnapshot = {};
    for (const sid of data.snapshot_entities || []) if (states[sid]) sceneSnapshot[sid] = clone(states[sid]);
  }
  if (domain === "script" && service === "turn_on" && ids(entity).includes("script.alles_aus")) {
    for (const id of HINTS.alles_aus_covered as string[]) {
      if (states[id]?.state !== "on") continue;
      if (domainOf(id) === "light") lightOff(id);
      else setState(id, "off");
    }
  }
  refreshGroups();
}

function record(via: string, domain: string, service: string, entity_id?: any, data?: any) {
  seq += 1;
  calls.push({ seq, t: Date.now(), domain, service, entity_id, data, via });
  if (!cfg.noresp) setTimeout(() => applyService(domain, service, entity_id, data || {}), cfg.delayMs);
}

// ---- actions (mirrors backend/app/actions.py) -----------------------------------
const GROUP_KINDS = new Set(["group", "switch_group"]);
const on = (id: string) => states[id]?.state === "on";
const kg = (role: string, id?: string) => board.start.kommen_gehen.find((k: any) => k.role === role && (!id || k.id === id));

function group(id: string): { kind: string; members: string[]; name: string } {
  const it = board.items[id];
  if (it && GROUP_KINDS.has(it.kind)) return { kind: it.kind, members: it.members || [], name: it.name };
  const g = kg("group", id);
  if (g) return { kind: "group", members: g.members || [], name: g.name };
  throw Object.assign(new Error("unknown"), { status: 404 });
}

function offTargets(scope: string, id?: string): [string[], string] {
  const items = board.items;
  if (scope === "alles_aus") {
    const covered = new Set(HINTS.alles_aus_covered as string[]);
    const t = Object.keys(items).filter((e) => {
      const it = items[e];
      return !GROUP_KINDS.has(it.kind) && !e.startsWith("virtual.") && it.tier !== "hidden" &&
        ["light", "switch", "input_boolean"].includes(domainOf(e)) && on(e) && covered.has(e);
    });
    return [t.sort(), kg("alles_aus")?.name || "Alles aus"];
  }
  if (scope === "zone") {
    const z = board.zones.find((x: any) => x.id === id);
    if (!z) throw Object.assign(new Error("unknown"), { status: 404 });
    return [z.light_targets.filter(on), `${z.name}: Licht aus`];
  }
  if (scope === "group") {
    const g = group(id || "");
    return [g.members.filter(on), `${g.name} aus`];
  }
  if (scope === "ambiente") {
    const a = kg("ambiente") || { count: [], name: "Ambiente" };
    return [a.count.filter(on), `${a.name || "Ambiente"} aus`];
  }
  if (scope === "lights") {
    const t = Object.keys(items).filter((e) => domainOf(e) === "light" && items[e].count && items[e].tier !== "hidden" && !GROUP_KINDS.has(items[e].kind) && on(e));
    return [t.sort(), "Alle Lichter aus"];
  }
  throw Object.assign(new Error("scope"), { status: 422 });
}

function openHint(): string | null {
  const names: string[] = [];
  for (const b of board.start.lage) if (b.key === "oeffnungen") for (const c of b.contacts) if (on(c.id)) names.push(c.name);
  if (!names.length) return null;
  return `${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2}` : ""} offen`;
}

function actionOff(body: any) {
  const [targets, label] = offTargets(body.scope, body.id);
  const res: any = { undo: null, label, count: targets.length, hint: openHint(), partial: false, expires_in: 0 };
  if (!targets.length) return res;
  const via = `actions/off:${body.scope}`;
  const snap = targets.filter((e) => ["light", "switch", "input_boolean", "fan"].includes(domainOf(e)) && !isGroup(e));
  if (snap.length) record(via, "scene", "create", undefined, { scene_id: board.undo_scene_id || "wdh_undo", snapshot_entities: snap });
  if (body.scope === "alles_aus") record(via, "script", "turn_on", kg("alles_aus")?.script || "script.alles_aus");
  else if (body.scope === "ambiente") record(via, "homeassistant", "turn_off", targets);
  else if (body.scope === "group") record(via, group(body.id).kind === "switch_group" ? "switch" : "light", "turn_off", targets);
  else
    for (const dom of ["light", "input_boolean"]) {
      const t = targets.filter((e) => domainOf(e) === dom);
      if (t.length) record(via, dom, "turn_off", t);
    }
  if (body.scope === "alles_aus") {
    const tv = board.items["virtual.fernsehen"]?.tv;
    res.partial = !!tv && !["off", "unavailable", "unknown", "standby", undefined].includes(states[tv]?.state);
  }
  if (snap.length) {
    const ttl = body.scope === "alles_aus" ? 10 : 8;
    undoSeq += 1;
    undoSlot = { token: `u${undoSeq}`, deadline: Date.now() + (ttl + (body.scope === "alles_aus" ? 0 : 5)) * 1000 };
    res.undo = undoSlot.token;
    res.expires_in = ttl;
  }
  return res;
}

function actionOn(body: any) {
  const via = `actions/on:${body.scope}`;
  if (body.scope === "ambiente") {
    const action = kg("ambiente")?.action || [];
    if (action.length) record(via, "homeassistant", "turn_on", action);
    return { status: "ok", count: action.length };
  }
  if (body.scope === "group") {
    const g = group(body.id);
    if (g.kind === "switch_group") record(via, "switch", "turn_on", g.members);
    else record(via, "light", "turn_on", body.id, body.brightness_pct ? { brightness_pct: body.brightness_pct } : undefined);
    return { status: "ok", count: g.members.length };
  }
  throw Object.assign(new Error("scope"), { status: 422 });
}

// ---- scenarios -------------------------------------------------------------------
function applyScenario(name: string) {
  states = clone(BASE_STATES);
  board = clone(BASE_BOARD);
  sceneSnapshot = {};
  undoSlot = null;
  if (name && name !== "base") {
    // "extends": parent scenario, own states/items win.
    const load = (n: string): any => {
      const s = read(`scenarios/${n}.json`);
      if (!s.extends) return s;
      const p = load(s.extends);
      return { ...p, ...s, states: { ...p.states, ...s.states }, items: { ...(p.items || {}), ...(s.items || {}) } };
    };
    const sc = load(name);
    const base = sc.now ? new Date(sc.now).getTime() : Date.now();
    for (const id in sc.states || {}) {
      const o = sc.states[id];
      const prev = states[id] || { entity_id: id, state: "unknown", attributes: {}, lc_ts: base };
      const next: State = { ...prev, attributes: { ...prev.attributes, ...(o.attributes || {}) } };
      if (o.state !== undefined) next.state = o.state;
      if (o.lc_ago_min !== undefined) next.lc_ts = base - o.lc_ago_min * 60000;
      if (o.lc !== undefined) next.lc_ts = new Date(o.lc).getTime();
      if (o.finishes !== undefined) next.finishes_ts = new Date(o.finishes).getTime();
      states[id] = next;
    }
    for (const id in sc.items || {}) Object.assign(board.items[id], sc.items[id]);
    // Recompute light-group states from members, like HA does.
    for (const id in states) {
      if (!isGroup(id) || domainOf(id) !== "light" || (sc.states && sc.states[id] && sc.states[id].state)) continue;
      const anyOn = (states[id].attributes.entity_id as string[]).some((m) => states[m]?.state === "on");
      states[id] = { ...states[id], state: anyOn ? "on" : "off" };
    }
  }
  rev += 1;
  broadcast(boardMsg());
  broadcast(snapshotMsg());
}

// ---- HTTP helpers ---------------------------------------------------------------
function json(res: ServerResponse, body: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((ok) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      try {
        ok(b ? JSON.parse(b) : {});
      } catch {
        ok({});
      }
    });
  });
}

function mockApi(): Plugin {
  return {
    name: "mock-api",
    configureServer(server) {
      if (process.env.WDH_SCENARIO) applyScenario(process.env.WDH_SCENARIO);

      server.httpServer?.on("upgrade", (req, socket: Socket) => {
        const url = new URL(req.url || "/", "http://x");
        if (url.pathname !== "/ws") return; // leave Vite HMR alone
        const key = req.headers["sec-websocket-key"];
        if (typeof key !== "string") return;
        socket.on("error", () => {
          sockets.delete(socket);
          socket.destroy();
        });
        socket.on("close", () => sockets.delete(socket));
        if (Date.now() < refuseUntil) {
          socket.destroy();
          return;
        }
        const accept = createHash("sha1").update(key + WS_GUID).digest("base64");
        socket.write(
          "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
            `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
        );
        sockets.add(socket);
        send(socket, { type: "hello", version: "2.0.0", ha_connected: !cfg.haDown });
        if (!cfg.haDown) {
          send(socket, boardMsg());
          send(socket, snapshotMsg());
        }
      });

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || "/", "http://x");
        const p = url.pathname;
        const m = req.method || "GET";
        try {
          if (p === "/__mock/calls") {
            if (m === "DELETE") calls = [];
            return json(res, calls);
          }
          if (p === "/__mock/scenario") {
            const b = await readBody(req);
            applyScenario(b.name || "base");
            calls = [];
            return json(res, { ok: true, rev });
          }
          if (p === "/__mock/config") {
            cfg = { ...cfg, ...(await readBody(req)) };
            if (!cfg.haDown) {
              broadcast({ type: "ha_status", connected: true });
              broadcast(boardMsg());
              broadcast(snapshotMsg());
            } else broadcast({ type: "ha_status", connected: false });
            return json(res, cfg);
          }
          if (p === "/__mock/state") {
            const b = await readBody(req);
            setState(b.entity_id, b.state ?? null, b.attributes);
            refreshGroups();
            return json(res, states[b.entity_id]);
          }
          if (p === "/__mock/drop") {
            const b = await readBody(req);
            refuseUntil = Date.now() + (b.seconds || 10) * 1000;
            sockets.forEach((s) => s.destroy());
            sockets.clear();
            return json(res, { refuseUntil });
          }

          if (p === "/api/board") return cfg.haDown ? json(res, { detail: "HA nicht verbunden" }, 503) : json(res, { ...board, rev });
          if (p === "/api/dashboards" && m === "GET") return json(res, [settingsDoc]);
          if (p.indexOf("/api/dashboards/") === 0 && m === "PUT") {
            const b = await readBody(req);
            Object.assign(settingsDoc, b);
            return json(res, settingsDoc);
          }
          if (p === "/api/hostinfo") return json(res, { host: "192.0.2.10", port: 8099 });
          if (p === "/api/service" && m === "POST") {
            const b = await readBody(req);
            if (cfg.fail) return json(res, { detail: "HA-Fehler (Mock)" }, 502);
            record("service", b.domain, b.service, b.entity_id, b.data);
            return json(res, { status: "ok" });
          }
          if (p === "/api/actions/off" && m === "POST") {
            if (cfg.fail) return json(res, { detail: "HA-Fehler (Mock)" }, 502);
            return json(res, actionOff(await readBody(req)));
          }
          if (p === "/api/actions/on" && m === "POST") {
            if (cfg.fail) return json(res, { detail: "HA-Fehler (Mock)" }, 502);
            return json(res, actionOn(await readBody(req)));
          }
          if (p === "/api/actions/undo" && m === "POST") {
            const b = await readBody(req);
            if (!undoSlot || undoSlot.token !== b.undo || Date.now() > undoSlot.deadline) return json(res, { detail: "Rückgängig abgelaufen" }, 410);
            undoSlot = null;
            record("actions/undo", "scene", "turn_on", `scene.${board.undo_scene_id || "wdh_undo"}`);
            return json(res, { status: "ok" });
          }
          const seen = /^\/api\/zones\/items\/([^/]+)\/seen$/.exec(p);
          if (seen && m === "POST") {
            const id = decodeURIComponent(seen[1]);
            if (board.items[id]) board.items[id].new = false;
            calls.push({ seq: ++seq, t: Date.now(), domain: "zones", service: "seen", entity_id: id, via: "zones" });
            rev += 1;
            broadcast(boardMsg());
            return json(res, { rev });
          }
          if (p.indexOf("/api/zones/") === 0) {
            const b = await readBody(req);
            calls.push({ seq: ++seq, t: Date.now(), domain: "zones", service: `${m} ${p}`, data: b, via: "zones" });
            return json(res, { rev });
          }
        } catch (e: any) {
          return json(res, { detail: String(e?.message || e) }, e?.status || 500);
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), mockApi()],
  server: { host: true, port: 5199, strictPort: true },
});
