import { useState } from "react";
import type { Dashboard } from "../state/dashboards";
import "./editor.css";

interface Props {
  dashboards: Dashboard[];
  current: Dashboard | null;
  onSelect: (id: string) => void;
  onCreateNew: (name: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onDone: () => void;
}

type Mode = "idle" | "creating" | "renaming" | "confirmDelete";

export function EditBar({
  dashboards,
  current,
  onSelect,
  onCreateNew,
  onRename,
  onDelete,
  onDone,
}: Props) {
  const [mode, setMode] = useState<Mode>("idle");
  const [text, setText] = useState("");

  const startRename = () => {
    setText(current?.name ?? "");
    setMode("renaming");
  };
  const startCreate = () => {
    setText("");
    setMode("creating");
  };

  const commit = () => {
    const name = text.trim();
    if (mode === "creating" && name) onCreateNew(name);
    if (mode === "renaming" && name) onRename(name);
    setMode("idle");
  };

  return (
    <div className="editbar">
      {mode === "idle" && (
        <>
          <select
            className="editbar__select"
            value={current?.id ?? ""}
            onChange={(e) => onSelect(e.target.value)}
          >
            {dashboards.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button type="button" className="editbar__btn" onClick={startCreate}>
            + Neu
          </button>
          <button type="button" className="editbar__btn" onClick={startRename} disabled={!current}>
            ✎ Umbenennen
          </button>
          <button
            type="button"
            className="editbar__btn editbar__btn--danger"
            onClick={() => setMode("confirmDelete")}
            disabled={!current}
          >
            🗑 Löschen
          </button>
          <span className="editbar__spacer" />
          <button type="button" className="editbar__done" onClick={onDone}>
            Fertig
          </button>
        </>
      )}

      {(mode === "creating" || mode === "renaming") && (
        <>
          <input
            className="editbar__input"
            type="text"
            placeholder={mode === "creating" ? "Neues Dashboard" : "Name"}
            value={text}
            autoFocus
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setMode("idle");
            }}
          />
          <button type="button" className="editbar__btn" onClick={commit}>
            ✓ OK
          </button>
          <button type="button" className="editbar__btn" onClick={() => setMode("idle")}>
            ✗ Abbrechen
          </button>
        </>
      )}

      {mode === "confirmDelete" && (
        <>
          <span className="editbar__confirm">„{current?.name}" wirklich löschen?</span>
          <button
            type="button"
            className="editbar__btn editbar__btn--danger"
            onClick={() => {
              onDelete();
              setMode("idle");
            }}
          >
            Ja, löschen
          </button>
          <button type="button" className="editbar__btn" onClick={() => setMode("idle")}>
            Abbrechen
          </button>
        </>
      )}
    </div>
  );
}
