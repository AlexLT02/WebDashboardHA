import { useEffect, useMemo, useState } from "react";
import { getStoredCalendarConfig } from "../state/calendar";
import { apiUrl } from "../state/basePath";

interface Props {
  onConnect: () => void;
}

export function AgendaPanel({ onConnect }: Props) {
  const [config, setConfig] = useState(() => getStoredCalendarConfig());
  const [events, setEvents] = useState<Array<{ id?: string; summary: string; start?: Record<string, unknown>; end?: Record<string, unknown>; htmlLink?: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const nextConfig = getStoredCalendarConfig();
    setConfig(nextConfig);
    if (!nextConfig?.enabled) {
      setEvents([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    fetch(apiUrl("/api/calendar"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextConfig),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Abruf fehlgeschlagen (${res.status})`);
        const payload = await res.json();
        setEvents(payload.events ?? []);
        setError(null);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
        setEvents([]);
      });

    return () => controller.abort();
  }, []);

  const connectedLabel = useMemo(() => {
    if (!config?.enabled) return "Kein Kalender verbunden";
    return `${config.label ?? "Google Kalender"} (${config.calendarId ?? "primary"})`;
  }, [config]);

  return (
    <>
      <div className="ag__label">Termine</div>

      {config?.enabled ? (
        <div className="ha-scroll" style={{ display: "grid", gap: 8, paddingRight: 4 }}>
          {error ? (
            <div style={{ fontSize: 12.5, color: "#fda4af" }}>{error}</div>
          ) : events.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>Keine Termine gefunden.</div>
          ) : (
            events.map((event) => (
              <div key={event.id ?? event.summary} style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(125,211,252,0.12)", border: "1px solid rgba(125,211,252,0.22)" }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{event.summary}</div>
                <div style={{ fontSize: 12.2, color: "var(--text-dim)", marginTop: 4 }}>
                  {(event.start?.dateTime as string | undefined) ?? (event.start?.date as string | undefined) ?? "Ganztägig"}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="ag__empty ha-scroll">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" className="ag__empty-icon">
            <path d="M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zM5 9h14v10H5V9z" />
          </svg>
          <div className="ag__empty-title">{connectedLabel}</div>
          <div className="ag__empty-text">
            Verbinde einen Kalender, um Termine hier zu sehen.
          </div>
        </div>
      )}

      <button type="button" className="ag__connect" onClick={onConnect}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
        </svg>
        {config?.enabled ? "Kalender ändern" : "Kalender verbinden"}
      </button>
    </>
  );
}
