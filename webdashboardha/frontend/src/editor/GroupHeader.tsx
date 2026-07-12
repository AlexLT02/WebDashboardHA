import { useState } from "react";
import "./editor.css";

interface Props {
  name: string;
  editMode: boolean;
  columns: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onRename: (name: string) => void;
  onRemove: () => void;
  onAddWidget: () => void;
  onSetColumns: (columns: number) => void;
  onMove: (dir: -1 | 1) => void;
}

type Mode = "idle" | "renaming" | "confirmDelete";

/** Gruppen-Kopf: im Normalmodus nur der Titel (falls gesetzt), im Edit-Modus
 *  mit Spaltenzahl, Verschieben, Umbenennen/Löschen/„+ Widget". */
export function GroupHeader({
  name,
  editMode,
  columns,
  canMoveUp,
  canMoveDown,
  onRename,
  onRemove,
  onAddWidget,
  onSetColumns,
  onMove,
}: Props) {
  const [mode, setMode] = useState<Mode>("idle");
  const [text, setText] = useState(name);

  if (!editMode) {
    if (!name) return null;
    return <h2 className="group__title">{name}</h2>;
  }

  return (
    <div className="group__bar">
      {mode === "idle" && (
        <>
          <span className="group__name">{name || "Ohne Titel"}</span>

          {/* Spaltenzahl (Gruppengröße) */}
          <span className="group__cols">
            <button
              type="button"
              className="group__btn"
              aria-label="weniger Spalten"
              disabled={columns <= 1}
              onClick={() => onSetColumns(columns - 1)}
            >
              −
            </button>
            <span className="group__cols-val" title="Spalten">
              {columns}◫
            </span>
            <button
              type="button"
              className="group__btn"
              aria-label="mehr Spalten"
              disabled={columns >= 8}
              onClick={() => onSetColumns(columns + 1)}
            >
              +
            </button>
          </span>

          {/* Gruppe verschieben */}
          <button
            type="button"
            className="group__btn"
            aria-label="Gruppe nach oben"
            disabled={!canMoveUp}
            onClick={() => onMove(-1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="group__btn"
            aria-label="Gruppe nach unten"
            disabled={!canMoveDown}
            onClick={() => onMove(1)}
          >
            ↓
          </button>

          <button
            type="button"
            className="group__btn"
            aria-label="umbenennen"
            onClick={() => {
              setText(name);
              setMode("renaming");
            }}
          >
            ✎
          </button>
          <button
            type="button"
            className="group__btn group__btn--danger"
            aria-label="Gruppe löschen"
            onClick={() => setMode("confirmDelete")}
          >
            🗑
          </button>
          <span className="editbar__spacer" />
          <button type="button" className="group__add" onClick={onAddWidget}>
            + Widget
          </button>
        </>
      )}

      {mode === "renaming" && (
        <>
          <input
            className="editbar__input"
            type="text"
            placeholder="Gruppentitel (leer = keiner)"
            value={text}
            autoFocus
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onRename(text.trim());
                setMode("idle");
              }
              if (e.key === "Escape") setMode("idle");
            }}
          />
          <button
            type="button"
            className="group__btn"
            onClick={() => {
              onRename(text.trim());
              setMode("idle");
            }}
          >
            ✓
          </button>
          <button type="button" className="group__btn" onClick={() => setMode("idle")}>
            ✗
          </button>
        </>
      )}

      {mode === "confirmDelete" && (
        <>
          <span className="group__name">Gruppe löschen? (Widgets gehen mit)</span>
          <button
            type="button"
            className="group__btn group__btn--danger"
            onClick={() => {
              onRemove();
              setMode("idle");
            }}
          >
            Ja
          </button>
          <button type="button" className="group__btn" onClick={() => setMode("idle")}>
            Nein
          </button>
        </>
      )}
    </div>
  );
}
