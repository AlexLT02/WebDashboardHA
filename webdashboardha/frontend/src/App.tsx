import { useEffect, useState } from "react";
import { connectWs } from "./state/ws";
import { useStore } from "./state/store";
import { useDashboards } from "./state/useDashboards";
import { WidgetUpdateContext } from "./state/widgetContext";
import { DashboardGrid } from "./dashboard/DashboardGrid";
import { ActiveView } from "./dashboard/ActiveView";
import { EditBar } from "./editor/EditBar";
import { AddWidgetDialog } from "./editor/AddWidgetDialog";
import "./App.css";
import "./editor/editor.css";

type View = "dashboard" | "active";

export default function App() {
  const dash = useDashboards();
  const [editMode, setEditMode] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  const [addTarget, setAddTarget] = useState<string | null>(null);
  const connected = useStore((s) => s.connected);
  const haConnected = useStore((s) => s.haConnected);

  useEffect(() => connectWs(), []);

  const offline = !connected || !haConnected;
  const error = dash.error;

  return (
    <WidgetUpdateContext.Provider value={dash.updateWidgetOptions}>
      <div className="app">
        {editMode && view === "dashboard" ? (
          <EditBar
            dashboards={dash.dashboards}
            current={dash.current}
            onSelect={dash.select}
            onCreateNew={dash.createNew}
            onRename={dash.rename}
            onDelete={dash.removeCurrent}
            onDone={() => setEditMode(false)}
          />
        ) : (
          <div className="view-switch">
            <button
              type="button"
              className={`view-switch__btn${view === "dashboard" ? " is-active" : ""}`}
              onClick={() => setView("dashboard")}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={`view-switch__btn${view === "active" ? " is-active" : ""}`}
              onClick={() => setView("active")}
            >
              Aktive Geräte
            </button>
          </div>
        )}

        {error && <div className="app__error">{error}</div>}

        <main className="app__main">
          {!dash.current ? (
            dash.loading ? (
              <div className="app__loading">Lädt…</div>
            ) : (
              !error && <div className="app__loading">Kein Dashboard.</div>
            )
          ) : view === "active" ? (
            <ActiveView dashboard={dash.current} />
          ) : (
            <DashboardGrid
              dashboard={dash.current}
              editMode={editMode}
              onAddWidget={(groupId) => setAddTarget(groupId)}
              onRemoveWidget={dash.removeWidget}
              onPlaceWidget={dash.placeWidgetAt}
              onResizeWidget={dash.resizeWidget}
              onRenameGroup={dash.renameGroup}
              onRemoveGroup={dash.removeGroup}
              onSetGroupColumns={dash.setGroupColumns}
              onMoveGroup={dash.moveGroup}
              onAddGroup={() => dash.addGroup("")}
            />
          )}
        </main>

        {!editMode && view === "dashboard" && (
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
            onPickSpecial={(type) => dash.addSpecialWidget(type, addTarget)}
            onClose={() => setAddTarget(null)}
          />
        )}

        {offline && (
          <div className="conn-warn" role="status">
            <span className="conn-warn__dot" />
            {!connected ? "Getrennt" : "HA getrennt"}
          </div>
        )}
      </div>
    </WidgetUpdateContext.Provider>
  );
}
