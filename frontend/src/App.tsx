import { useEffect, useState } from "react";
import { connectWs } from "./state/ws";
import { useStore } from "./state/store";
import { fetchDashboards, type Dashboard } from "./state/dashboards";
import { DashboardGrid } from "./dashboard/DashboardGrid";
import "./App.css";

export default function App() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connected = useStore((s) => s.connected);
  const haConnected = useStore((s) => s.haConnected);

  // WebSocket-Verbindung (Live-States) über die App-Lebensdauer halten.
  useEffect(() => connectWs(), []);

  // Dashboards laden (im MVP: erstes Dashboard anzeigen).
  useEffect(() => {
    fetchDashboards()
      .then((list) => {
        if (list.length > 0) setDashboard(list[0]);
        else setError("Kein Dashboard vorhanden.");
      })
      .catch((e) => setError(String(e)));
  }, []);

  const offline = !connected || !haConnected;

  return (
    <div className="app">
      {error && <div className="app__error">{error}</div>}

      <main className="app__main">
        {dashboard ? (
          <DashboardGrid dashboard={dashboard} />
        ) : (
          !error && <div className="app__loading">Lädt…</div>
        )}
      </main>

      {/* Nur bei Trennung ein dezenter Hinweis — sonst bleibt der Kiosk clean. */}
      {offline && (
        <div className="conn-warn" role="status">
          <span className="conn-warn__dot" />
          {!connected ? "Getrennt" : "HA getrennt"}
        </div>
      )}
    </div>
  );
}
