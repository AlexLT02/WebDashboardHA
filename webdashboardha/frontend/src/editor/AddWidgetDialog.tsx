import { useEffect, useMemo, useState } from "react";
import { fetchEntities, SPECIAL_WIDGETS, type EntityInfo } from "../state/dashboards";
import "./editor.css";

const DOMAIN_LABEL: Record<string, string> = {
  light: "Licht",
  switch: "Schalter",
  input_boolean: "Schalter",
  fan: "Lüfter",
  sensor: "Sensor",
  binary_sensor: "Sensor",
  weather: "Wetter",
  media_player: "Medien",
};

interface Props {
  onPick: (entity: EntityInfo) => void;
  onPickSpecial: (type: string) => void;
  onClose: () => void;
}

export function AddWidgetDialog({ onPick, onPickSpecial, onClose }: Props) {
  const [entities, setEntities] = useState<EntityInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchEntities()
      .then(setEntities)
      .catch((e) => setError(String(e)));
  }, []);

  const filtered = useMemo(() => {
    if (!entities) return [];
    const q = query.trim().toLowerCase();
    if (!q) return entities;
    return entities.filter(
      (e) => e.name.toLowerCase().includes(q) || e.entity_id.toLowerCase().includes(q),
    );
  }, [entities, query]);

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="picker" onClick={(e) => e.stopPropagation()}>
        <div className="picker__header">
          <h2 className="picker__title">Widget hinzufügen</h2>
          <button type="button" className="dialog__close" aria-label="Schließen" onClick={onClose}>
            ✕
          </button>
        </div>

        <input
          className="picker__search"
          type="text"
          placeholder="Suchen…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        {!query && (
          <div className="picker__special">
            {SPECIAL_WIDGETS.map((s) => (
              <button
                key={s.type}
                type="button"
                className="picker__chip"
                onClick={() => {
                  onPickSpecial(s.type);
                  onClose();
                }}
              >
                + {s.label}
              </button>
            ))}
          </div>
        )}

        <div className="picker__list">
          {error && <div className="picker__msg">{error}</div>}
          {!entities && !error && <div className="picker__msg">Lädt…</div>}
          {entities && filtered.length === 0 && (
            <div className="picker__msg">Nichts gefunden.</div>
          )}
          {filtered.map((e) => (
            <button
              key={e.entity_id}
              type="button"
              className="picker__row"
              onClick={() => {
                onPick(e);
                onClose();
              }}
            >
              <span className="picker__name">{e.name}</span>
              <span className="picker__meta">
                <span className="picker__badge">{DOMAIN_LABEL[e.domain] ?? e.domain}</span>
                <span className="picker__eid">{e.entity_id}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
