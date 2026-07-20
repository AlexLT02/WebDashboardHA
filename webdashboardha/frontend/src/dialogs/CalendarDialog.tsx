import { useEffect, useMemo, useState } from "react";
import { getStoredCalendarConfig, saveCalendarConfig, type CalendarConfig } from "../state/calendar";
import { Dialog } from "./Dialog";

export function CalendarDialog({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<CalendarConfig | null>(null);
  const [calendarId, setCalendarId] = useState("primary");
  const [label, setLabel] = useState("Google Kalender");
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = getStoredCalendarConfig();
    if (stored) {
      setConfig(stored);
      setCalendarId(stored.calendarId ?? "primary");
      setLabel(stored.label ?? "Google Kalender");
      setApiKey(stored.apiKey ?? "");
    } else {
      setConfig({ provider: "google", enabled: false, calendarId: "primary", label: "Google Kalender" });
    }
  }, []);

  const statusText = useMemo(() => {
    if (!config?.enabled) return "Noch nicht verbunden";
    return `${config.label ?? "Google Kalender"} (${config.calendarId ?? "primary"})`;
  }, [config]);

  const handleSave = () => {
    const next = saveCalendarConfig({ provider: "google", enabled: true, calendarId, label, apiKey });
    setConfig(next);
    setSaved(true);
  };

  return (
    <Dialog title="Kalender verbinden" onClose={onClose}>
      <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "#9aa2b1", margin: "0 0 18px" }}>
        Verbinde einen Google-Kalender direkt über die Google Calendar API. Die
        Konfiguration wird lokal im Browser gespeichert und im Dashboard als
        Kalenderquelle verwendet.
      </p>

      <div className="dlg__setting" style={{ marginBottom: 12 }}>
        <div>
          <div className="dlg__setting-t">Kalenderquelle</div>
          <div className="dlg__setting-d">{statusText}</div>
        </div>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: config?.enabled ? "#7dd3fc" : "var(--text-dim)" }}>
          {config?.enabled ? "Verbunden" : "Nicht verbunden"}
        </span>
      </div>

      <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>Name im Dashboard</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #3b4252", background: "#111827", color: "#f8fafc" }} />
      </label>

      <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>Google Calendar-ID</span>
        <input value={calendarId} onChange={(e) => setCalendarId(e.target.value)} placeholder="primary" style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #3b4252", background: "#111827", color: "#f8fafc" }} />
      </label>

      <label style={{ display: "grid", gap: 6, marginBottom: 14 }}>
        <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>Google API-Key</span>
        <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API-Schlüssel" style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #3b4252", background: "#111827", color: "#f8fafc" }} />
      </label>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12.5, color: "#7dd3fc" }}>{saved ? "Konfiguration gespeichert." : "Die Daten bleiben lokal im Browser."}</span>
        <button type="button" onClick={handleSave} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#7dd3fc", color: "#07111f", fontWeight: 700, cursor: "pointer" }}>
          Speichern
        </button>
      </div>
    </Dialog>
  );
}
