/**
 * Auflösung von API-/WebSocket-URLs relativ zum Ausliefer-Pfad.
 *
 * Unter HA-Ingress läuft das SPA nicht unter "/", sondern unter einem
 * dynamischen Pfad wie /api/hassio_ingress/<token>/. Absolute Pfade wie
 * "/api/health" würden an HA statt ans Add-on gehen. Darum leiten wir die
 * Basis aus dem aktuellen Verzeichnis der Seite ab.
 *
 * Im Kiosk-Modus (eigener Port 8099) ist die Basis schlicht "/".
 */
function baseDir(): string {
  // Verzeichnis der aktuell geladenen Seite, immer mit "/" am Ende.
  const path = window.location.pathname;
  return path.endsWith("/") ? path : path.replace(/[^/]*$/, "");
}

/** Baut eine absolute HTTP(S)-URL für einen API-Pfad (führender Slash optional). */
export function apiUrl(path: string): string {
  const clean = path.replace(/^\//, "");
  return baseDir() + clean;
}

/** Baut die WebSocket-URL (ws/wss passend zum Protokoll) für einen Pfad. */
export function wsUrl(path: string): string {
  const clean = path.replace(/^\//, "");
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${baseDir()}${clean}`;
}
