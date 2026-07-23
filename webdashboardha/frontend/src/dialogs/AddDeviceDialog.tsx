import { useEffect, useMemo, useState } from "react";
import { fetchEntities, type EntityInfo } from "../state/dashboards";
import { resolveIcon } from "../controls/icons";
import { Dialog } from "./Dialog";

interface Props {
  /** Zielkategorie (aus dem „Gerät"-Button einer Kategorie) — optional. */
  targetCategory?: string;
  /** Bereits auf dem Dashboard vorhandene Entity-IDs — werden als „hinzugefügt" markiert. */
  existing?: string[];
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

export function AddDeviceDialog({ targetCategory, existing, onPick, onClose }: Props) {
  const [entities, setEntities] = useState<EntityInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // In dieser Sitzung hinzugefügte Entities — Dialog bleibt für Mehrfachauswahl offen.
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchEntities()
      .then(setEntities)
      .catch((e) => setError(String(e)));
  }, []);

  const onBoard = useMemo(() => new Set(existing ?? []), [existing]);

  const filtered = useMemo(() => {
    if (!entities) return [];
    const q = query.trim().toLowerCase();
    if (!q) return entities;
    return entities.filter(
      (e) => e.name.toLowerCase().includes(q) || e.entity_id.toLowerCase().includes(q),
    );
  }, [entities, query]);

  const add = (e: EntityInfo) => {
    onPick(e, targetCategory);
    setAdded((prev) => {
      const next = new Set(prev);
      next.add(e.entity_id);
      return next;
    });
  };

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
          const isAdded = added.has(e.entity_id) || onBoard.has(e.entity_id);
          return (
            <button
              key={e.entity_id}
              type="button"
              className={`dlg__additem${isAdded ? " is-added" : ""}`}
              disabled={isAdded}
              onClick={() => add(e)}
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
              <span className="dlg__additem-plus">{isAdded ? "✓" : "＋"}</span>
            </button>
          );
        })}
      </div>
      <div className="dlg__gap--sm" />
      <button type="button" className="dlg__primary" onClick={onClose}>
        {added.size > 0 ? `Fertig (${added.size} hinzugefügt)` : "Fertig"}
      </button>
    </Dialog>
  );
}
