// Lokaler UI-Test OHNE HA-Backend: liefert Mock-Daten für /api/dashboards.
// Start:  npx vite --config vite.mock.config.mts   ->  http://localhost:5199
// Kann jederzeit gelöscht werden (nicht committen).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

const mockDashboard = {
  id: "mock",
  name: "Mock",
  columns: 2,
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
      ],
    },
  ],
};

function mockApi(): Plugin {
  return {
    name: "mock-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || "";
        if (url.startsWith("/api/dashboards") && req.method === "GET") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify([mockDashboard]));
          return;
        }
        if (url.startsWith("/api/entities")) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify([]));
          return;
        }
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
