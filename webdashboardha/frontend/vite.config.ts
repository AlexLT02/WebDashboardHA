import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";

// iPad Air 1 hängt fest auf iPadOS 12.5 / Safari 12. Der Legacy-Build
// transpiliert nach ES5-nah und injiziert core-js-Polyfills + SystemJS,
// sonst weißer Bildschirm (moderne Vite-Defaults liefern ES2020+ aus).
const LEGACY_TARGETS = ["ios_saf >= 12", "safari >= 12"];

export default defineConfig({
  // Relative Pfade sind für HA-Ingress zwingend: das Panel wird unter einem
  // dynamischen Pfad /api/hassio_ingress/<token>/ eingebunden. Absolute
  // /assets/... würden ins Leere zeigen.
  base: "./",
  plugins: [
    react(),
    legacy({
      targets: LEGACY_TARGETS,
      // Zusätzliche Polyfills, die core-js nicht automatisch aus Syntax ableitet.
      additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
      // KRITISCH für Safari 12: kein modernes Chunk rendern. Safari 12 kann
      // <script type=module> laden, würde also sonst das moderne ES2020-Bundle
      // ziehen und crashen. So bekommen ALLE Browser das transpilierte
      // SystemJS-Bundle — garantiert lauffähig auf dem iPad Air 1.
      renderModernChunks: false,
    }),
  ],
  build: {
    // build.target wird von plugin-legacy verwaltet (targets oben).
    minify: "terser",
    cssTarget: "safari12",
    // Bundle-Budget: warnt, wenn ein Chunk zu groß fürs iPad wird.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // React getrennt cachebar halten.
        manualChunks: {
          react: ["react", "react-dom"],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
