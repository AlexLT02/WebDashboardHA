import { useEffect, useRef, useState } from "react";
import { connectWs } from "./state/ws";
import { useStore } from "./state/store";
import { useBoard, type BoardSettings } from "./state/useBoard";
import { allWidgets, domainOf, isOn } from "./state/board";
import { useEdgePanels } from "./shell/useEdgePanels";
import { ControlPanel, type HistoryEntry } from "./shell/ControlPanel";
import { EditBar } from "./shell/EditBar";
import { Screensaver } from "./shell/Screensaver";
import { Header } from "./dashboard/Header";
import { DashboardView } from "./dashboard/DashboardView";
import { ActiveView } from "./dashboard/ActiveView";
import { MoreInfoDialog } from "./dialogs/MoreInfoDialog";
import { AddDeviceDialog } from "./dialogs/AddDeviceDialog";
import { SettingsDialog } from "./dialogs/SettingsDialog";
import type { DetailKind } from "./widgets/Tile";
import type { WidgetConfig } from "./state/dashboards";
import "./App.css";

type View = "dashboard" | "active";

type DialogState =
  | { type: "detail"; widget: WidgetConfig; kind: DetailKind }
  | { type: "add" }
  | { type: "settings" }
  | null;

const IDLE_MS = 60000; // 1 Min bis zum Bildschirmschoner

function nowLabel(): string {
  const d = new Date();
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export default function App() {
  const board = useBoard();
  const states = useStore((s) => s.states);
  const connected = useStore((s) => s.connected);
  const haConnected = useStore((s) => s.haConnected);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const panels = useEdgePanels(rootRef);

  const [view, setView] = useState<View>("dashboard");
  const [editMode, setEditMode] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [saver, setSaver] = useState(false);
  const historyId = useRef(0);

  useEffect(() => connectWs(), []);

  const widgets = allWidgets(board.current);
  const activeCount = widgets.filter((w) => isOn(domainOf(w), states[w.entity_id]?.state)).length;

  const logAction = (text: string, color: string) => {
    historyId.current += 1;
    const entry: HistoryEntry = { id: historyId.current, text, time: nowLabel(), color };
    setHistory((h) => [entry, ...h].slice(0, 6));
  };

  const closeDialog = () => setDialog(null);

  const toggleEdit = () => {
    setEditMode((e) => !e);
    setView("dashboard");
    panels.close();
  };

  const showActive = () => {
    setView("active");
    panels.close();
  };

  const setSetting = (key: keyof BoardSettings, value: boolean) => {
    board.setSetting(key, value);
    if (key === "kiosk") {
      try {
        const el = document.documentElement as HTMLElement & {
          webkitRequestFullscreen?: () => void;
        };
        const doc = document as Document & { webkitExitFullscreen?: () => void };
        if (value) (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el);
        else if (document.fullscreenElement)
          (doc.exitFullscreen ?? doc.webkitExitFullscreen)?.call(doc);
      } catch {
        /* Fullscreen nicht verfügbar — kein Beinbruch */
      }
    }
  };

  // Bildschirmschoner: nach IDLE_MS ohne Interaktion große Uhr zeigen.
  useEffect(() => {
    if (!board.settings.screensaver) {
      setSaver(false);
      return;
    }
    let timer = window.setTimeout(() => setSaver(true), IDLE_MS);
    const reset = () => {
      setSaver(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setSaver(true), IDLE_MS);
    };
    window.addEventListener("mousedown", reset);
    window.addEventListener("touchstart", reset, { passive: true });
    window.addEventListener("keydown", reset);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("mousedown", reset);
      window.removeEventListener("touchstart", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [board.settings.screensaver]);

  return (
    <div className="root" ref={rootRef}>
      <div className="stage">
        {/* ---- Steuer-Panel (links) ---- */}
        <aside
          className={`panel panel--left${panels.leftOpen ? " is-open" : ""}`}
          data-panel="left"
        >
          <ControlPanel
            connected={connected}
            haConnected={haConnected}
            deviceTotal={widgets.length}
            activeCount={activeCount}
            view={view}
            editMode={editMode}
            history={history}
            onSettings={() => setDialog({ type: "settings" })}
            onShowActive={showActive}
            onToggleEdit={toggleEdit}
          />
        </aside>

        {/* ---- Hauptbereich ---- */}
        <main className="main">
          {view === "active" ? (
            <div className="main__head">
              <button
                type="button"
                className="backbtn"
                aria-label="Zurück"
                onClick={() => setView("dashboard")}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6z" />
                </svg>
              </button>
              <div>
                <div className="main__title">Aktive Geräte</div>
                <div className="main__meta">{activeCount} Geräte an</div>
              </div>
            </div>
          ) : (
            <Header />
          )}

          {editMode && view === "dashboard" && board.current && (
            <EditBar
              dashboards={board.dashboards}
              current={board.current}
              onSelect={board.select}
              onRename={board.rename}
              onCreateNew={board.createNew}
              onDelete={board.removeCurrent}
            />
          )}

          {board.error && <div className="app-error">{board.error}</div>}

          {board.loading ? (
            <div className="dash-empty">Lädt…</div>
          ) : !board.current ? (
            <div className="dash-empty">Kein Dashboard vorhanden.</div>
          ) : view === "active" ? (
            <ActiveView
              widgets={widgets}
              onOpen={(w, kind) => setDialog({ type: "detail", widget: w, kind })}
              onRemoveWidget={board.removeWidget}
              onAction={logAction}
            />
          ) : (
            <DashboardView
              widgets={widgets}
              editMode={editMode}
              onOpen={(w, kind) => setDialog({ type: "detail", widget: w, kind })}
              onRemoveWidget={board.removeWidget}
              onAddDevice={() => setDialog({ type: "add" })}
              onAction={logAction}
            />
          )}
        </main>

        {/* ---- Edge-Grip (links) ---- */}
        {!panels.leftOpen && <div className="grip grip--left" onClick={panels.openLeft} />}
      </div>

      {/* ---- Dialoge ---- */}
      {dialog?.type === "detail" && (
        <MoreInfoDialog
          widget={dialog.widget}
          kind={dialog.kind}
          onClose={closeDialog}
          onUpdateOptions={board.updateWidgetOptions}
        />
      )}
      {dialog?.type === "add" && (
        <AddDeviceDialog onPick={(entity) => board.addWidget(entity)} onClose={closeDialog} />
      )}
      {dialog?.type === "settings" && (
        <SettingsDialog settings={board.settings} onSetting={setSetting} onClose={closeDialog} />
      )}

      {/* ---- Verbindungswarnung ---- */}
      {(!connected || !haConnected) && (
        <div className="conn-warn" role="status">
          <span className="conn-warn__dot" />
          {!connected ? "Getrennt" : "HA getrennt"}
        </div>
      )}

      {/* ---- Bildschirmschoner ---- */}
      {saver && <Screensaver onDismiss={() => setSaver(false)} />}
    </div>
  );
}
