interface Props {
  onConnect: () => void;
}

/**
 * Agenda-/Kalender-Panel. Es gibt noch kein Kalender-Backend, daher ein
 * ehrlicher Leerzustand statt erfundener Termine (die auf einem echten
 * Wand-Dashboard irreführend wären).
 */
export function AgendaPanel({ onConnect }: Props) {
  return (
    <>
      <div className="ag__label">Termine</div>

      <div className="ag__empty ha-scroll">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" className="ag__empty-icon">
          <path d="M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zM5 9h14v10H5V9z" />
        </svg>
        <div className="ag__empty-title">Kein Kalender verbunden</div>
        <div className="ag__empty-text">
          Verbinde einen Kalender, um Termine hier zu sehen.
        </div>
      </div>

      <button type="button" className="ag__connect" onClick={onConnect}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
        </svg>
        Kalender verbinden
      </button>
    </>
  );
}
