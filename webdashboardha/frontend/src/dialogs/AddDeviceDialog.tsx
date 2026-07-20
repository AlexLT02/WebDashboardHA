import { useEffect, useMemo, useState } from "react";
import { fetchEntities, type EntityInfo } from "../state/dashboards";
import { resolveIcon } from "../controls/icons";
import { Dialog } from "./Dialog";

interface Props {
  /** Zielkategorie (aus dem „Gerät"-Button einer Kategorie) — optional. */
  targetCategory?: string;
  onPick: (entity: EntityInfo, categoryKey?: string) => void;
  onClose: () => void;
}

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

export function AddDeviceDialog({ targetCategory, onPick, onClose }: Props) {
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
    <Dialog title="Gerät hinzufügen" onClose={onClose}>
      <input
        className="dlg__search"
        type="text"
        placeholder="Gerät oder Entität suchen…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      <div className="dlg__list ha-scroll">
        {error && <div className="dlg__msg">{error}</div>}
        {!entities && !error && <div className="dlg__msg">Lädt…</div>}
        {entities && filtered.length === 0 && <div className="dlg__msg">Nichts gefunden.</div>}
        {filtered.map((e) => {
          const Icon = resolveIcon(undefined, e.domain, undefined, e.name);
          return (
            <button
              key={e.entity_id}
              type="button"
              className="dlg__additem"
              onClick={() => {
                onPick(e, targetCategory);
                onClose();
              }}
            >
              <span className="dlg__additem-badge">
                <Icon size={18} />
              </span>
              <span className="dlg__additem-name">
                {e.name}
                <span className="dlg__additem-eid">
                  {DOMAIN_LABEL[e.domain] ?? e.domain} · {e.entity_id}
                </span>
              </span>
              <span className="dlg__additem-plus">＋</span>
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}
