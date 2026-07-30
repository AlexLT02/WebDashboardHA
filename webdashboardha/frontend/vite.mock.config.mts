// Lokaler UI-Test OHNE HA-Backend: liefert Mock-Daten für /api/dashboards,
// /api/entities und einen Mini-WebSocket auf /ws (Snapshot mit Beispiel-States).
// Start:  npx vite --config vite.mock.config.mts   ->  http://localhost:5199
// Nur zum lokalen Entwickeln/Verifizieren — nicht Teil des Add-on-Builds.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import type { Socket } from "node:net";
import type { Plugin } from "vite";

const mockDashboard = {
  id: "mock",
  name: "Mock",
  columns: 2,
  // Nachtmodus: `night` auf true setzen (und ggf. das Fenster auf die aktuelle
  // Uhrzeit legen), um die Abdunklung im Test auszulösen.
  meta: {
    settings: {
      night: false,
      nightStart: "22:00",
      nightEnd: "06:30",
      nightDim: 0.85,
      nightFadeSec: 900,
    },
  },
  groups: [
    {
      id: "L",
      name: "",
      columns: 6,
      ungrouped: true,
      widgets: [
        { id: "wc", type: "clock", entity_id: "", title: null, x: 3, y: 0, w: 2, h: 2, options: {} },
        { id: "wl", type: "light", entity_id: "light.loose", title: "Loses Licht", x: 5, y: 0, w: 1, h: 1, options: {} },
        { id: "ws", type: "sensor", entity_id: "sensor.loose", title: "Loser Sensor", x: 3, y: 2, w: 1, h: 1, options: {} },
      ],
    },
    {
      id: "g1",
      name: "Wohnzimmer",
      columns: 3,
      x: 0,
      y: 0,
      widgets: [
        { id: "a", type: "light", entity_id: "light.a", title: "Decke", x: 0, y: 0, w: 1, h: 1, options: {} },
        { id: "b", type: "sensor", entity_id: "sensor.b", title: "Temperatur", x: 1, y: 0, w: 1, h: 1, options: {} },
        { id: "c", type: "switch", entity_id: "switch.c", title: "Steckdose", x: 0, y: 1, w: 2, h: 1, options: {} },
        { id: "r1", type: "cover", entity_id: "cover.rolladen_wohnzimmer", title: "Rollladen Wohnzimmer", x: 1, y: 1, w: 1, h: 1, options: {} },
        { id: "r2", type: "cover", entity_id: "cover.rolladen_schlafzimmer", title: "Rollladen Schlafzimmer", x: 2, y: 1, w: 1, h: 1, options: {} },
        { id: "r3", type: "cover", entity_id: "cover.garage", title: "Garagentor", x: 0, y: 2, w: 1, h: 1, options: {} },
      ],
    },
  ],
};

// supported_features: OPEN|CLOSE|SET_POSITION|STOP = 15, ohne SET_POSITION/STOP = 3.
const mockStates: Record<string, unknown> = {
  // Absichtlich überlange Namen (ganz oben) — testet die Laufschrift in der Geräteauswahl.
  "cover.rolladen_terrassentuer_links": {
    entity_id: "cover.rolladen_terrassentuer_links",
    state: "open",
    attributes: {
      friendly_name: "Rollladen Wohnzimmer Terrassentür links (Sonnenschutz)",
      device_class: "shutter",
      current_position: 80,
      supported_features: 15,
    },
  },
  "light.esszimmer_pendelleuchte_dimmbar": {
    entity_id: "light.esszimmer_pendelleuchte_dimmbar",
    state: "off",
    attributes: { friendly_name: "Esszimmer Pendelleuchte über dem Tisch dimmbar" },
  },
  "sensor.thermometer_alex_temperature": {
    entity_id: "sensor.thermometer_alex_temperature",
    state: "21.4",
    attributes: { friendly_name: "Thermometer Alex", unit_of_measurement: "°C", device_class: "temperature" },
  },
  "light.a": { entity_id: "light.a", state: "on", attributes: { friendly_name: "Decke", brightness: 180 } },
  "light.loose": { entity_id: "light.loose", state: "off", attributes: { friendly_name: "Loses Licht" } },
  "sensor.b": { entity_id: "sensor.b", state: "21.4", attributes: { friendly_name: "Temperatur", unit_of_measurement: "°C", device_class: "temperature" } },
  "sensor.loose": { entity_id: "sensor.loose", state: "48", attributes: { friendly_name: "Loser Sensor", unit_of_measurement: "%" } },
  "switch.c": { entity_id: "switch.c", state: "off", attributes: { friendly_name: "Steckdose" } },
  "cover.rolladen_wohnzimmer": {
    entity_id: "cover.rolladen_wohnzimmer",
    state: "open",
    attributes: { friendly_name: "Rollladen Wohnzimmer", device_class: "shutter", current_position: 60, supported_features: 15 },
  },
  "cover.rolladen_schlafzimmer": {
    entity_id: "cover.rolladen_schlafzimmer",
    state: "closing",
    attributes: { friendly_name: "Rollladen Schlafzimmer", device_class: "shutter", current_position: 35, supported_features: 15 },
  },
  "cover.garage": {
    entity_id: "cover.garage",
    state: "closed",
    attributes: { friendly_name: "Garagentor", device_class: "garage", supported_features: 3 },
  },
};

const mockEntities = Object.keys(mockStates).map((id) => ({
  entity_id: id,
  name: String((mockStates[id] as { attributes: Record<string, string> }).attributes.friendly_name),
  domain: id.split(".")[0],
}));

// ---- Minimaler WebSocket-Server (nur Senden, kein Frame-Parsing nötig) ----
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

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

function json(res: { setHeader: (k: string, v: string) => void; end: (b: string) => void }, body: unknown) {
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function mockApi(): Plugin {
  return {
    name: "mock-api",
    configureServer(server) {
      server.httpServer?.on("upgrade", (req, socket: Socket) => {
        if (!(req.url || "").endsWith("/ws")) return; // Vite-HMR nicht anfassen
        const key = req.headers["sec-websocket-key"];
        if (typeof key !== "string") return;
        // Abgebrochene Verbindungen dürfen den Dev-Server nicht killen.
        socket.on("error", () => socket.destroy());
        const accept = createHash("sha1").update(key + WS_GUID).digest("base64");
        try {
          socket.write(
            "HTTP/1.1 101 Switching Protocols\r\n" +
              "Upgrade: websocket\r\n" +
              "Connection: Upgrade\r\n" +
              `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
          );
          socket.write(
            wsFrame(JSON.stringify({ type: "snapshot", states: mockStates, ha_connected: true })),
          );
        } catch {
          socket.destroy();
        }
      });

      server.middlewares.use((req, res, next) => {
        const url = req.url || "";
        if (url.startsWith("/api/dashboards") && req.method === "GET") return json(res, [mockDashboard]);
        if (url.startsWith("/api/entities")) return json(res, mockEntities);
        if (url.startsWith("/api/hostinfo")) return json(res, { host: "192.168.2.50", port: 8099 });
        if (url.startsWith("/api/service")) return json(res, { status: "ok" });
        if (url.startsWith("/api/dashboards") && req.method === "PUT") {
          let body = "";
          req.on("data", (c) => (body += c));
          req.on("end", () => {
            res.setHeader("Content-Type", "application/json");
            res.end(body || "{}");
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), mockApi()],
  server: { host: true, port: 5199 },
});
