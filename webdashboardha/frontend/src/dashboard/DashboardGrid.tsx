import { useCallback, useEffect, useRef, useState } from "react";
import type { Dashboard, Group, WidgetConfig } from "../state/dashboards";
import { emptyCells, rowCount } from "../state/grid";
import { eventPoint, clamp } from "../controls/pointer";
import { WidgetView as Widget } from "../widgets/WidgetView";
import { GroupHeader } from "../editor/GroupHeader";
import { SettingsSheet } from "../widgets/SettingsSheet";
import { displayName } from "../state/display";
import "./DashboardGrid.css";
import "../editor/editor.css";

const ROW_H = 76; // px pro Rasterzeile
const GAP = 10;
const DASHBOARD_COLS = 6; // Gesamtbreite des Dashboards in Rastereinheiten

interface DragState {
  widget: WidgetConfig;
  fromGroupId: string;
  offX: number;
  offY: number;
  width: number;
  height: number;
}

interface Props {
  dashboard: Dashboard;
  editMode?: boolean;
  onAddWidget?: (groupId: string) => void;
  onRemoveWidget?: (groupId: string, widgetId: string) => void;
  onPlaceWidget?: (widgetId: string, toGroupId: string, x: number, y: number) => void;
  onResizeWidget?: (groupId: string, widgetId: string, w: number, h: number) => void;
  onRenameGroup?: (groupId: string, name: string) => void;
  onRemoveGroup?: (groupId: string) => void;
  onSetGroupColumns?: (groupId: string, columns: number) => void;
  onMoveGroup?: (groupId: string, dir: -1 | 1) => void;
  onAddGroup?: () => void;
}

export function DashboardGrid({
  dashboard,
  editMode,
  onAddWidget,
  onRemoveWidget,
  onPlaceWidget,
  onResizeWidget,
  onRenameGroup,
  onRemoveGroup,
  onSetGroupColumns,
  onMoveGroup,
  onAddGroup,
}: Props) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [settingsWidget, setSettingsWidget] = useState<WidgetConfig | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [target, setTarget] = useState<{ groupId: string; x: number; y: number } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const targetRef = useRef<typeof target>(null);
  const raf = useRef(0);

  const totalWidgets = dashboard.groups.reduce((n, g) => n + g.widgets.length, 0);

  const computeTarget = useCallback(
    (x: number, y: number) => {
      const el = document.elementFromPoint(x, y);
      const gridEl = el?.closest("[data-grid-group]") as HTMLElement | null;
      if (!gridEl) return null;
      const groupId = gridEl.getAttribute("data-grid-group")!;
      const group = dashboard.groups.find((g) => g.id === groupId);
      if (!group) return null;
      const rect = gridEl.getBoundingClientRect();
      const cols = Math.max(1, group.columns);
      const col = clamp(Math.floor((x - rect.left) / (rect.width / cols)), 0, cols - 1);
      const row = Math.max(0, Math.floor((y - rect.top) / (ROW_H + GAP)));
      return { groupId, x: col, y: row };
    },
    [dashboard.groups],
  );

  const onMove = useCallback(
    (e: TouchEvent | MouseEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      const p = eventPoint(e);
      if (!p) return;
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        setPointer({ x: p.x, y: p.y });
        const t = computeTarget(p.x, p.y);
        targetRef.current = t;
        setTarget(t);
      });
    },
    [computeTarget],
  );

  const onUp = useCallback(() => {
    const d = dragRef.current;
    const t = targetRef.current;
    if (d && t) onPlaceWidget?.(d.widget.id, t.groupId, t.x, t.y);
    dragRef.current = null;
    targetRef.current = null;
    setDrag(null);
    setTarget(null);
  }, [onPlaceWidget]);

  useEffect(() => {
    if (!drag) return;
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, onMove, onUp]);

  // ---- Resize (eigener Griff unten rechts) ----
  const [resize, setResize] = useState<{ groupId: string; widget: WidgetConfig } | null>(null);
  const [resizeTo, setResizeTo] = useState<{ w: number; h: number } | null>(null);
  const resizeRef = useRef<{ groupId: string; widget: WidgetConfig } | null>(null);
  const resizeToRef = useRef<{ w: number; h: number } | null>(null);

  const onResizeMove = useCallback(
    (e: TouchEvent | MouseEvent) => {
      const r = resizeRef.current;
      if (!r) return;
      e.preventDefault();
      const p = eventPoint(e);
      if (!p) return;
      const gridEl = document.querySelector(
        `[data-grid-group="${r.groupId}"]`,
      ) as HTMLElement | null;
      const group = dashboard.groups.find((g) => g.id === r.groupId);
      if (!gridEl || !group) return;
      const rect = gridEl.getBoundingClientRect();
      const cols = Math.max(1, group.columns);
      const colW = rect.width / cols;
      const cellLeft = rect.left + r.widget.x * colW;
      const cellTop = rect.top + r.widget.y * (ROW_H + GAP);
      const w = clamp(Math.round((p.x - cellLeft) / colW), 1, cols - r.widget.x);
      const h = Math.max(1, Math.round((p.y - cellTop) / (ROW_H + GAP)));
      const to = { w, h };
      resizeToRef.current = to;
      setResizeTo(to);
    },
    [dashboard.groups],
  );

  const onResizeUp = useCallback(() => {
    const r = resizeRef.current;
    const to = resizeToRef.current;
    if (r && to) onResizeWidget?.(r.groupId, r.widget.id, to.w, to.h);
    resizeRef.current = null;
    resizeToRef.current = null;
    setResize(null);
    setResizeTo(null);
  }, [onResizeWidget]);

  useEffect(() => {
    if (!resize) return;
    window.addEventListener("touchmove", onResizeMove, { passive: false });
    window.addEventListener("touchend", onResizeUp);
    window.addEventListener("mousemove", onResizeMove);
    window.addEventListener("mouseup", onResizeUp);
    return () => {
      window.removeEventListener("touchmove", onResizeMove);
      window.removeEventListener("touchend", onResizeUp);
      window.removeEventListener("mousemove", onResizeMove);
      window.removeEventListener("mouseup", onResizeUp);
    };
  }, [resize, onResizeMove, onResizeUp]);

  const startResize = (
    groupId: string,
    widget: WidgetConfig,
    e: React.TouchEvent | React.MouseEvent,
  ) => {
    e.stopPropagation();
    const state = { groupId, widget };
    resizeRef.current = state;
    setResize(state);
    setResizeTo({ w: widget.w, h: widget.h });
  };

  const startDrag = (groupId: string, widget: WidgetConfig, e: React.TouchEvent | React.MouseEvent) => {
    const tile = (e.currentTarget as HTMLElement).closest(".grid-cell") as HTMLElement | null;
    const p = eventPoint(e.nativeEvent as TouchEvent | MouseEvent);
    if (!tile || !p) return;
    const rect = tile.getBoundingClientRect();
    const state: DragState = {
      widget,
      fromGroupId: groupId,
      offX: p.x - rect.left,
      offY: p.y - rect.top,
      width: rect.width,
      height: rect.height,
    };
    dragRef.current = state;
    setDrag(state);
    setPointer({ x: p.x, y: p.y });
  };

  if (totalWidgets === 0 && !editMode) {
    return (
      <div className="dashboard-empty">
        <p>Noch keine Widgets in „{dashboard.name}".</p>
        <p className="dashboard-empty__hint">Zum Bearbeiten unten auf den Stift tippen.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-groups">
      {dashboard.groups.map((group: Group, gi) => {
        const rows = rowCount(group) + (editMode ? 1 : 0);
        const gridStyle: React.CSSProperties = {
          gridTemplateColumns: `repeat(${Math.max(1, group.columns)}, 1fr)`,
          gridAutoRows: `${ROW_H}px`,
          gap: `${GAP}px`,
          minHeight: editMode ? rows * (ROW_H + GAP) : undefined,
        };
        const isTargetGroup = target?.groupId === group.id;
        const span = Math.min(Math.max(1, group.columns), DASHBOARD_COLS);
        return (
          <section
            className="group"
            key={group.id}
            style={{ gridColumn: `span ${span}` }}
          >
            <GroupHeader
              name={group.name}
              editMode={Boolean(editMode)}
              columns={group.columns}
              canMoveUp={gi > 0}
              canMoveDown={gi < dashboard.groups.length - 1}
              onRename={(name) => onRenameGroup?.(group.id, name)}
              onRemove={() => onRemoveGroup?.(group.id)}
              onAddWidget={() => onAddWidget?.(group.id)}
              onSetColumns={(c) => onSetGroupColumns?.(group.id, c)}
              onMove={(dir) => onMoveGroup?.(group.id, dir)}
            />
            <div className="dashboard-grid" data-grid-group={group.id} style={gridStyle}>
              {/* Sichtbares Raster: leere Zellen als Drop-Slots (nur Edit-Modus) */}
              {editMode &&
                emptyCells(group, rows).map((c) => (
                  <div
                    className="grid-slot"
                    key={`slot-${c.x}-${c.y}`}
                    style={{ gridColumn: `${c.x + 1} / span 1`, gridRow: `${c.y + 1} / span 1` }}
                  />
                ))}
              {isTargetGroup && target && (
                <div
                  className="grid-target"
                  style={{
                    gridColumn: `${target.x + 1} / span 1`,
                    gridRow: `${target.y + 1} / span 1`,
                  }}
                />
              )}
              {resize?.groupId === group.id && resizeTo && (
                <div
                  className="grid-target"
                  style={{
                    gridColumn: `${resize.widget.x + 1} / span ${resizeTo.w}`,
                    gridRow: `${resize.widget.y + 1} / span ${resizeTo.h}`,
                  }}
                />
              )}
              {group.widgets.map((w) => {
                const dragging = drag?.widget.id === w.id;
                const cellStyle: React.CSSProperties = {
                  gridColumn: `${w.x + 1} / span ${w.w}`,
                  gridRow: `${w.y + 1} / span ${w.h}`,
                };
                return (
                  <div
                    className={`grid-cell${dragging ? " is-dragging" : ""}${
                      editMode ? " is-edit" : ""
                    }`}
                    style={cellStyle}
                    key={w.id}
                  >
                    {editMode && (
                      <div className="edit-overlay">
                        <button
                          type="button"
                          className="edit-overlay__btn edit-overlay__handle"
                          aria-label="ziehen"
                          onTouchStart={(e) => startDrag(group.id, w, e)}
                          onMouseDown={(e) => startDrag(group.id, w, e)}
                        >
                          ⠿
                        </button>
                        <button
                          type="button"
                          className="edit-overlay__btn"
                          aria-label="Einstellungen"
                          onClick={() => setSettingsWidget(w)}
                        >
                          ⚙
                        </button>
                        <button
                          type="button"
                          className="edit-overlay__btn edit-overlay__btn--danger"
                          aria-label="entfernen"
                          onClick={() => onRemoveWidget?.(group.id, w.id)}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    <div className={editMode ? "grid-cell__widget" : undefined}>
                      <Widget config={w} />
                    </div>
                    {editMode && (
                      <button
                        type="button"
                        className="resize-handle"
                        aria-label="Größe ändern"
                        onTouchStart={(e) => startResize(group.id, w, e)}
                        onMouseDown={(e) => startResize(group.id, w, e)}
                      >
                        ⤡
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {editMode && (
        <button
          type="button"
          className="add-group"
          style={{ gridColumn: "1 / -1" }}
          onClick={onAddGroup}
        >
          + Gruppe
        </button>
      )}

      {/* Schwebende Kopie am Finger */}
      {drag && (
        <div
          className="drag-ghost"
          style={{
            left: pointer.x - drag.offX,
            top: pointer.y - drag.offY,
            width: drag.width,
            height: drag.height,
          }}
        >
          <Widget config={drag.widget} />
        </div>
      )}

      {/* Einstellungen (Alias/Icon) im Edit-Modus */}
      {settingsWidget && (
        <div className="dialog-backdrop" onClick={() => setSettingsWidget(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog__header">
              <button
                type="button"
                className="dialog__close"
                aria-label="Schließen"
                onClick={() => setSettingsWidget(null)}
              >
                ✕
              </button>
              <h2 className="dialog__title">{displayName(settingsWidget)}</h2>
              <span />
            </div>
            <SettingsSheet config={settingsWidget} />
          </div>
        </div>
      )}
    </div>
  );
}
