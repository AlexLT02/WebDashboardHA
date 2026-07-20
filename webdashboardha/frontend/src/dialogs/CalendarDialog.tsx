import { useEffect, useMemo, useState } from "react";
import {
  finishGoogleCalendarAuth,
  getStoredCalendarConfig,
  saveCalendarConfig,
  startGoogleCalendarAuth,
  type CalendarConfig,
  type GoogleCalendarEntry,
} from "../state/calendar";
import { Dialog } from "./Dialog";

export function CalendarDialog({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<CalendarConfig | null>(null);
  const [calendarId, setCalendarId] = useState("primary");
  const [label, setLabel] = useState("Google Kalender");
  const [calendarList, setCalendarList] = useState<GoogleCalendarEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = getStoredCalendarConfig();
    if (stored) {
      setConfig(stored);
      setCalendarId(stored.calendarId ?? "primary");
      setLabel(stored.label ?? "Google Kalender");
    } else {
      setConfig({ provider: "google", enabled: false, calendarId: "primary", label: "Google Kalender" });
    }
  }, []);

  const statusText = useMemo(() => {
    if (!config?.enabled) return "Noch nicht verbunden";
    return `${config.label ?? "Google Kalender"} (${config.calendarId ?? "primary"})`;
  }, [config]);

  const handleConnect = async () => {
    try {
      setLoading(true);
      setError(null);
      const authUrl = await startGoogleCalendarAuth();
      window.open(authUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google-Login fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthCallback = async (code: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await finishGoogleCalendarAuth(code);
      const nextConfig = saveCalendarConfig({
        provider: "google",
        enabled: true,
        calendarId: result.calendars[0]?.id ?? "primary",
        label: result.calendars[0]?.summary ?? "Google Kalender",
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      setConfig(nextConfig);
      setCalendarId(nextConfig.calendarId ?? "primary");
      setLabel(nextConfig.label ?? "Google Kalender");
      setCalendarList(result.calendars);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google-Login fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      void handleOAuthCallback(code);
    }

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "google-calendar-auth") return;
      const payload = event.data?.payload as { accessToken?: string; refreshToken?: string; calendars?: GoogleCalendarEntry[] } | undefined;
      if (!payload?.accessToken) return;
      const nextConfig = saveCalendarConfig({
        provider: "google",
        enabled: true,
        calendarId: payload.calendars?.[0]?.id ?? "primary",
        label: payload.calendars?.[0]?.summary ?? "Google Kalender",
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken ?? "",
      });
      setConfig(nextConfig);
      setCalendarId(nextConfig.calendarId ?? "primary");
      setLabel(nextConfig.label ?? "Google Kalender");
      setCalendarList(payload.calendars ?? []);
      setSaved(true);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const handleSave = () => {
    const next = saveCalendarConfig({ provider: "google", enabled: true, calendarId, label, accessToken: config?.accessToken, refreshToken: config?.refreshToken });
    setConfig(next);
    setSaved(true);
  };

  return (
    <Dialog title="Kalender verbinden" onClose={onClose}>
      <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "#9aa2b1", margin: "0 0 18px" }}>
        Melde dich bei Google an, wähle deinen Kalender aus und verbinde ihn direkt mit dem Dashboard.
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

      {!config?.enabled && (
        <button type="button" onClick={handleConnect} disabled={loading} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#7dd3fc", color: "#07111f", fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>
          {loading ? "Öffne Google…" : "Mit Google anmelden"}
        </button>
      )}

      {error && <div style={{ color: "#fda4af", fontSize: 12.5, marginBottom: 10 }}>{error}</div>}

      {calendarList.length > 0 && (
        <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>Kalender auswählen</span>
          <select value={calendarId} onChange={(e) => setCalendarId(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #3b4252", background: "#111827", color: "#f8fafc" }}>
            {calendarList.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.summary}{entry.primary ? " (Primär)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>Name im Dashboard</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #3b4252", background: "#111827", color: "#f8fafc" }} />
      </label>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12.5, color: "#7dd3fc" }}>{saved ? "Konfiguration gespeichert." : "Nach dem Login wird dein Kalender direkt geladen."}</span>
        <button type="button" onClick={handleSave} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#7dd3fc", color: "#07111f", fontWeight: 700, cursor: "pointer" }}>
          Speichern
        </button>
      </div>
    </Dialog>
  );
}
