import { useEffect, useMemo, useRef, useState } from "react";
import { fetchEntities, type EntityInfo } from "../state/dashboards";
import { useStore } from "../state/store";
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
  cover: "Rollladen",
  sensor: "Sensor",
  binary_sensor: "Sensor",
  weather: "Wetter",
  media_player: "Medien",
};

/** `domain.object_id` — HA-Format einer Entity-ID. */
const ENTITY_ID_RE = /^[a-z][a-z0-9_]*\.[a-z0-9_]+$/;

// Laufschrift für zu lange Gerätenamen. Bewusst per CSS-Transition und mit EINEM
// Timer für die ganze Liste: `var()` in @keyframes ist auf Safari 12 unzuverlässig,
// und eine Dauer-Animation pro Zeile würde das iPad Air 1 unnötig belasten.
const MQ_PAUSE_MS = 3200; // Standzeit an Anfang/Ende (zum Lesen)
const MQ_SPEED_PX_S = 55; // Scroll-Tempo
const MQ_MIN_OVERFLOW = 4; // Sub-Pixel-Rauschen ignorieren

function mqDurationMs(shift: number): number {
  return Math.max(700, Math.min(6000, Math.round((shift / MQ_SPEED_PX_S) * 1000)));
}

export function AddDeviceDialog({ targetCategory, existing, onPick, onClose }: Props) {
  const [entities, setEntities] = useState<EntityInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState("");
  // In dieser Sitzung hinzugefügte Entities — Dialog bleibt für Mehrfachauswahl offen.
  const [added, setAdded] = useState<Set<string>>(new Set());
  // Alle HA-States (aus dem WS-Snapshot) — damit lässt sich eine getippte ID prüfen.
  const states = useStore((s) => s.states);

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

  // ---- Laufschrift: welche Namen passen nicht in ihre Zeile? ----
  const listRef = useRef<HTMLDivElement>(null);
  const [shifts, setShifts] = useState<Record<string, number>>({});
  const [atEnd, setAtEnd] = useState(false);

  // Ein einziger Lese-Durchlauf (= ein Layout) nach jedem Listen-Wechsel.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const boxes = list.querySelectorAll<HTMLElement>("[data-mq]");
    const next: Record<string, number> = {};
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      const inner = box.firstElementChild as HTMLElement | null;
      const id = box.getAttribute("data-mq");
      if (!inner || !id) continue;
      const over = inner.scrollWidth - box.clientWidth;
      if (over > MQ_MIN_OVERFLOW) next[id] = over;
    }
    setShifts(next);
  }, [filtered]);

  const hasMarquee = Object.keys(shifts).length > 0;
  useEffect(() => {
    if (!hasMarquee) return;
    const timer = window.setInterval(() => setAtEnd((v) => !v), MQ_PAUSE_MS);
    return () => {
      window.clearInterval(timer);
      setAtEnd(false);
    };
  }, [hasMarquee]);

  const add = (e: EntityInfo) => {
    onPick(e, targetCategory);
    setAdded((prev) => {
      const next = new Set(prev);
      next.add(e.entity_id);
      return next;
    });
  };

  // ---- Freie Entity-ID (für Geräte, die die Vorschlagsliste nicht führt) ----
  const manualId = manual.trim().toLowerCase();
  const manualValid = ENTITY_ID_RE.test(manualId);
  const manualState = manualValid ? states[manualId] : undefined;
  const manualAdded = manualValid && (added.has(manualId) || onBoard.has(manualId));

  const addManual = () => {
    if (!manualValid || manualAdded) return;
    add({
      entity_id: manualId,
      name: (manualState?.attributes.friendly_name as string) || manualId,
      domain: manualId.split(".")[0],
    });
    setManual("");
  };

  const manualHint = !manualId
    ? "Format: domain.objekt_id — z. B. cover.rolladen_wohnzimmer"
    : !manualValid
      ? "Ungültige Entity-ID (erwartet: domain.objekt_id)."
      : manualAdded
        ? "Ist schon auf dem Dashboard."
        : manualState
          ? `${(manualState.attributes.friendly_name as string) || manualId} · ${manualState.state}`
          : "In Home Assistant nicht gefunden — wird trotzdem angelegt.";

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
      <div className="dlg__list ha-scroll" ref={listRef}>
        {error && <div className="dlg__msg">{error}</div>}
        {!entities && !error && <div className="dlg__msg">Lädt…</div>}
        {entities && filtered.length === 0 && <div className="dlg__msg">Nichts gefunden.</div>}
        {filtered.map((e) => {
          const Icon = resolveIcon(undefined, e.domain, undefined, e.name);
          const isAdded = added.has(e.entity_id) || onBoard.has(e.entity_id);
          const shift = shifts[e.entity_id];
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
                <span className="dlg__mq" data-mq={e.entity_id}>
                  <span
                    className="dlg__mq-in"
                    style={
                      shift
                        ? {
                            transform: atEnd ? `translateX(-${shift}px)` : "translateX(0)",
                            transitionDuration: `${mqDurationMs(shift)}ms`,
                          }
                        : undefined
                    }
                  >
                    {e.name}
                  </span>
                </span>
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
      <div className="dlg__label">Entity-ID direkt hinzufügen</div>
      <div className="dlg__idrow">
        <input
          className="dlg__input"
          type="text"
          placeholder="cover.rolladen_wohnzimmer"
          value={manual}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addManual();
          }}
        />
        <button
          type="button"
          className="dlg__idbtn"
          aria-label="Entity-ID hinzufügen"
          disabled={!manualValid || manualAdded}
          onClick={addManual}
        >
          ＋
        </button>
      </div>
      <div className={`dlg__idhint${manualState && !manualAdded ? " is-ok" : ""}`}>{manualHint}</div>

      <div className="dlg__gap--sm" />
      <button type="button" className="dlg__primary" onClick={onClose}>
        {added.size > 0 ? `Fertig (${added.size} hinzugefügt)` : "Fertig"}
      </button>
    </Dialog>
  );
}
