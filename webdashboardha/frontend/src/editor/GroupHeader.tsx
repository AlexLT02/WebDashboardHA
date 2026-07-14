import { useState } from "react";
import "./editor.css";

interface Props {
  name: string;
  editMode: boolean;
  columns: number;
  onRename: (name: string) => void;
  onRemove: () => void;
  onAddWidget: () => void;
  onSetColumns: (columns: number) => void;
  /** Beginnt das Ziehen des ganzen Gruppen-Blocks im Dashboard-Raster. */
  onDragStart: (e: React.TouchEvent | React.MouseEvent) => void;
}

type Mode = "idle" | "renaming" | "confirmDelete";

/** Gruppen-Kopf: im Normalmodus nur der Titel (falls gesetzt), im Edit-Modus
 *  mit Spaltenzahl, Verschieben, Umbenennen/Löschen/„+ Widget". */
export function GroupHeader({
  name,
  editMode,
  columns,
  onRename,
  onRemove,
  onAddWidget,
  onSetColumns,
  onDragStart,
}: Props) {
  const [mode, setMode] = useState<Mode>("idle");
  const [text, setText] = useState(name);

  // Normalmodus: Titel als eigene <h2>-Zeile über dem Gruppen-Grid (releaste
  // Position). Ohne Namen keine Überschrift.
  if (!editMode) {
    if (!name) return null;
    return <h2 className="group__title">{name}</h2>;
  }

  return (
    <div className="group__bar">
      {mode === "idle" && (
        <>
          {/* Ganzen Gruppen-Block im Dashboard-Raster verschieben */}
          <button
            type="button"
            className="group__btn group__drag"
            aria-label="Gruppe verschieben"
            onTouchStart={onDragStart}
            onMouseDown={onDragStart}
          >
            ⠿
          </button>

          <span className="group__name">{name || "Ohne Titel"}</span>

          {/* Spaltenzahl (Gruppenbreite) */}
          <span className="group__cols">
            <button
              type="button"
              className="group__btn"
              aria-label="schmaler"
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
              aria-label="breiter"
              disabled={columns >= 6}
              onClick={() => onSetColumns(columns + 1)}
            >
              +
            </button>
          </span>

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
          <button
            type="button"
            className="group__btn group__btn--accent"
            aria-label="Widget hinzufügen"
            onClick={onAddWidget}
          >
            +
          </button>
        </>
      )}

      {mode === "renaming" && (
        <>
          <input
            className="editbar__input group__rename"
            type="text"
            placeholder="Titel (leer = keiner)"
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
          <span className="group__name">Löschen?</span>
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
