import { useEffect, useState } from "react";
import { connectWs } from "./state/ws";
import { useStore } from "./state/store";
import { useDashboards } from "./state/useDashboards";
import { DashboardGrid } from "./dashboard/DashboardGrid";
import { EditBar } from "./editor/EditBar";
import { AddWidgetDialog } from "./editor/AddWidgetDialog";
import "./App.css";
import "./editor/editor.css";

export default function App() {
  const dash = useDashboards();
  const [editMode, setEditMode] = useState(false);
  // Ziel-Gruppe für den Add-Widget-Picker (null = geschlossen).
  const [addTarget, setAddTarget] = useState<string | null>(null);
  const connected = useStore((s) => s.connected);
  const haConnected = useStore((s) => s.haConnected);

  // WebSocket-Verbindung (Live-States) über die App-Lebensdauer halten.
  useEffect(() => connectWs(), []);

  const offline = !connected || !haConnected;
  const error = dash.error;

  return (
    <div className="app">
      {editMode && (
        <EditBar
          dashboards={dash.dashboards}
          current={dash.current}
          onSelect={dash.select}
          onCreateNew={dash.createNew}
          onRename={dash.rename}
          onDelete={dash.removeCurrent}
          onDone={() => setEditMode(false)}
        />
      )}

      {error && <div className="app__error">{error}</div>}

      <main className="app__main">
        {dash.current ? (
          <DashboardGrid
            dashboard={dash.current}
            editMode={editMode}
            onAddWidget={(groupId) => setAddTarget(groupId)}
            onRemoveWidget={dash.removeWidget}
            onMoveWidget={dash.moveWidget}
            onRenameGroup={dash.renameGroup}
            onRemoveGroup={dash.removeGroup}
            onAddGroup={() => dash.addGroup("")}
          />
        ) : dash.loading ? (
          <div className="app__loading">Lädt…</div>
        ) : (
          !error && <div className="app__loading">Kein Dashboard.</div>
        )}
      </main>

      {/* Einstieg in den Edit-Modus — dezenter Stift-Button. */}
      {!editMode && (
        <button
          type="button"
          className="edit-fab"
          aria-label="Bearbeiten"
          onClick={() => setEditMode(true)}
        >
          ✎
        </button>
      )}

      {addTarget !== null && (
        <AddWidgetDialog
          onPick={(entity) => dash.addWidget(entity, addTarget)}
          onClose={() => setAddTarget(null)}
        />
      )}

      {/* Nur bei Trennung ein dezenter Hinweis — sonst bleibt der Kiosk clean. */}
      {offline && (
        <div className="conn-warn" role="status">
          <span className="conn-warn__dot" />
          {!connected ? "Getrennt" : "HA getrennt"}
        </div>
      )}
    </div>
  );
}
