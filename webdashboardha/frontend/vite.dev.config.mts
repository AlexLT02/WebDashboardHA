// Lokaler Dev-Server mit HMR, der /api + /ws ans laufende Backend (Port 8099) durchreicht.
// Start:  npx vite --config vite.dev.config.mts   ->  http://localhost:5173
// Nicht committen; kann jederzeit gelöscht werden.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:8099", changeOrigin: true },
      "/ws": { target: "ws://localhost:8099", ws: true },
    },
  },
});
