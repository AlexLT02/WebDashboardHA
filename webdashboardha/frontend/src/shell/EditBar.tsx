import type { Dashboard } from "../state/dashboards";

interface Props {
  dashboards: Dashboard[];
  current: Dashboard;
  onSelect: (id: string) => void;
  onRename: (name: string) => void;
  onCreateNew: (name: string) => void;
  onDelete: () => void;
}

/** Bearbeiten-Leiste: Dashboard wählen / umbenennen / neu / löschen. */
export function EditBar({ dashboards, current, onSelect, onRename, onCreateNew, onDelete }: Props) {
  const rename = () => {
    const name = window.prompt("Dashboard umbenennen:", current.name);
    if (name && name.trim()) onRename(name.trim());
  };
  const create = () => {
    const name = window.prompt("Name des neuen Dashboards:", "");
    if (name && name.trim()) onCreateNew(name.trim());
  };
  const remove = () => {
    if (dashboards.length <= 1) {
      window.alert("Das letzte Dashboard kann nicht gelöscht werden.");
      return;
    }
    if (window.confirm(`Dashboard „${current.name}" löschen?`)) onDelete();
  };

  return (
    <div className="editbar">
      <span className="editbar__label">Dashboard</span>
      <select
        className="editbar__select"
        value={current.id}
        onChange={(e) => onSelect(e.target.value)}
      >
        {dashboards.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <button type="button" className="editbar__btn" onClick={rename}>
        Umbenennen
      </button>
      <button type="button" className="editbar__btn" onClick={create}>
        ＋ Neu
      </button>
      <button type="button" className="editbar__btn editbar__btn--danger" onClick={remove}>
        Löschen
      </button>
    </div>
  );
}
