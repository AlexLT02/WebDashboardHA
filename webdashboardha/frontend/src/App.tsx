import { useEffect, useRef, useState } from "react";
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

  // Ansichts-Umschalter (Dashboard / Aktive Geräte) ist normal versteckt und
  // erscheint nur, wenn man am oberen Rand weiter „hinaus" navigiert:
  // PC = weiter hoch scrollen, iPad = am Anfang nach unten ziehen.
  const mainRef = useRef<HTMLElement | null>(null);
  const [showSwitcher, setShowSwitcher] = useState(false);

  useEffect(() => connectWs(), []);

  useEffect(() => {
    if (editMode) setShowSwitcher(false);
  }, [editMode]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el || editMode) return;
    let startY = 0;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollTop <= 0 && e.deltaY < 0) setShowSwitcher(true);
      else if (e.deltaY > 0) setShowSwitcher(false);
    };
    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const dy = (e.touches[0]?.clientY ?? 0) - startY;
      if (el.scrollTop <= 0 && dy > 24) setShowSwitcher(true);
      else if (dy < -10 || el.scrollTop > 4) setShowSwitcher(false);
    };
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [editMode]);

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
          <div className={`view-switch${showSwitcher ? " is-shown" : ""}`}>
            <button
              type="button"
              className={`view-switch__btn${view === "dashboard" ? " is-active" : ""}`}
              onClick={() => {
                setView("dashboard");
                setShowSwitcher(false);
              }}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={`view-switch__btn${view === "active" ? " is-active" : ""}`}
              onClick={() => {
                setView("active");
                setShowSwitcher(false);
              }}
            >
              Aktive Geräte
            </button>
          </div>
        )}

        {error && <div className="app__error">{error}</div>}

        <main className="app__main" ref={mainRef}>
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
              onPlaceWidgetLoose={dash.placeWidgetLoose}
              onMoveBlock={dash.moveBlockAt}
              onResizeWidget={dash.resizeWidget}
              onRenameGroup={dash.renameGroup}
              onRemoveGroup={dash.removeGroup}
              onSetGroupColumns={dash.setGroupColumns}
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
