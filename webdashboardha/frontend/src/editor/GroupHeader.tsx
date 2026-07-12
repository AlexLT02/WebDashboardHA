import { useState } from "react";
import "./editor.css";

interface Props {
  name: string;
  editMode: boolean;
  onRename: (name: string) => void;
  onRemove: () => void;
  onAddWidget: () => void;
}

type Mode = "idle" | "renaming" | "confirmDelete";

/** Gruppen-Kopf: im Normalmodus nur der Titel (falls gesetzt), im Edit-Modus
 *  mit Umbenennen/Löschen/„+ Widget". */
export function GroupHeader({ name, editMode, onRename, onRemove, onAddWidget }: Props) {
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
          <button
            type="button"
            className="group__btn"
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
