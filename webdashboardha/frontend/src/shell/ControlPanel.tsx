export interface HistoryEntry {
  id: number;
  text: string;
  time: string;
  color: string;
}

interface Props {
  connected: boolean;
  haConnected: boolean;
  deviceTotal: number;
  activeCount: number;
  view: "dashboard" | "active";
  editMode: boolean;
  history: HistoryEntry[];
  onSettings: () => void;
  onShowActive: () => void;
  onToggleEdit: () => void;
}

const GEAR =
  "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z";
const POWER =
  "M13 3h-2v10h2V3zm4.83 2.17-1.42 1.42A6.92 6.92 0 0 1 19 12a7 7 0 0 1-14 0c0-2.22 1.04-4.19 2.65-5.44L6.24 5.17A8.96 8.96 0 0 0 3 12a9 9 0 0 0 18 0c0-2.74-1.23-5.19-3.17-6.83z";
const PENCIL =
  "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z";

export function ControlPanel({
  connected,
  haConnected,
  deviceTotal,
  activeCount,
  view,
  editMode,
  history,
  onSettings,
  onShowActive,
  onToggleEdit,
}: Props) {
  const online = connected && haConnected;
  const statusText = !connected
    ? "Backend getrennt"
    : !haConnected
      ? "HA getrennt"
      : `Verbunden · ${deviceTotal} Geräte`;
  const activeSel = view === "active";

  return (
    <>
      <div className="cp__top">
        <div className="cp__brand">Dashboard</div>
        <button type="button" className="cp__iconbtn" aria-label="Einstellungen" onClick={onSettings}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
            <path d={GEAR} />
          </svg>
        </button>
      </div>

      <div className={`cp__status${online ? " is-online" : " is-offline"}`}>
        <span className="cp__dot">
          <span className="cp__dot-core" />
          <span className="cp__dot-halo" />
        </span>
        <div className="cp__status-text">
          <div className="cp__status-title">Home Assistant</div>
          <div className="cp__status-sub">{statusText}</div>
        </div>
      </div>

      <button
        type="button"
        className={`cp__nav${activeSel ? " is-active" : ""}`}
        onClick={onShowActive}
      >
        <span className="cp__nav-icon">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
            <path d={POWER} />
          </svg>
        </span>
        <span className="cp__nav-label">Aktive Geräte</span>
        <span className="cp__nav-count">{activeCount}</span>
      </button>

      <div className="cp__section">Letzte Aktionen</div>
      <div className="cp__history ha-scroll">
        {history.length === 0 ? (
          <div className="cp__history-empty">Noch keine Aktionen aufgezeichnet.</div>
        ) : (
          history.map((h) => (
            <div className="cp__hrow" key={h.id}>
              <span className="cp__hdot" style={{ background: h.color }} />
              <span className="cp__htext">{h.text}</span>
              <span className="cp__htime">{h.time}</span>
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        className={`cp__edit${editMode ? " is-active" : ""}`}
        onClick={onToggleEdit}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
          <path d={PENCIL} />
        </svg>
        <span>{editMode ? "Fertig" : "Bearbeiten"}</span>
      </button>
    </>
  );
}
