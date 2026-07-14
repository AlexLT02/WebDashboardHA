import { useCallback, useEffect, useRef, useState } from "react";
import { UNGROUPED, type Dashboard, type Group, type WidgetConfig } from "../state/dashboards";
import {
  DASHBOARD_COLS,
  dashboardRowCount,
  emptyCells,
  groupBlockHeight,
  groupBlockWidth,
  rowCount,
  topLevelEmptyCells,
} from "../state/grid";
import { eventPoint, clamp } from "../controls/pointer";
import { WidgetView as Widget } from "../widgets/WidgetView";
import { GroupHeader } from "../editor/GroupHeader";
import { SettingsSheet } from "../widgets/SettingsSheet";
import { displayName } from "../state/display";
import "./DashboardGrid.css";
import "../editor/editor.css";

const ROW_H = 64; // px pro Rasterzeile (kompakter HA-Tile-Stil)
const GAP = 8;

/** Drop-Ziel: entweder in eine echte Gruppe (interne Zelle) oder frei aufs
 *  Dashboard-Raster (Top-Level-Zelle). */
type Target =
  | { kind: "group"; groupId: string; x: number; y: number }
  | { kind: "root"; x: number; y: number };

interface DragState {
  kind: "widget" | "group";
  id: string; // widget-id oder group-id
  fromGroupId: string; // Quellgruppe (bei Widget) bzw. die Gruppe selbst
  label: string; // Ghost-Beschriftung (Gruppe)
  widget?: WidgetConfig; // Ghost-Inhalt (Widget)
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
  onPlaceWidgetLoose?: (widgetId: string, x: number, y: number) => void;
  onMoveBlock?: (blockId: string, x: number, y: number) => void;
  onResizeWidget?: (groupId: string, widgetId: string, w: number, h: number) => void;
  onRenameGroup?: (groupId: string, name: string) => void;
  onRemoveGroup?: (groupId: string) => void;
  onSetGroupColumns?: (groupId: string, columns: number) => void;
  onAddGroup?: () => void;
}

export function DashboardGrid({
  dashboard,
  editMode,
  onAddWidget,
  onRemoveWidget,
  onPlaceWidget,
  onPlaceWidgetLoose,
  onMoveBlock,
  onResizeWidget,
  onRenameGroup,
  onRemoveGroup,
  onSetGroupColumns,
  onAddGroup,
}: Props) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [settingsWidget, setSettingsWidget] = useState<WidgetConfig | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [target, setTarget] = useState<Target | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const targetRef = useRef<Target | null>(null);
  const raf = useRef(0);

  const groups = dashboard.groups;
  const realGroupList = groups.filter((g) => !g.ungrouped);
  const loose = groups.find((g) => g.ungrouped);
  const looseGroupId = loose?.id ?? UNGROUPED;
  const totalWidgets = groups.reduce((n, g) => n + g.widgets.length, 0);

  /** Top-Level-Zelle (Dashboard-Raster) aus einem Bildschirmpunkt. */
  const rootCell = useCallback((px: number, py: number): { x: number; y: number } | null => {
    const root = document.querySelector("[data-grid-root]") as HTMLElement | null;
    if (!root) return null;
    const rect = root.getBoundingClientRect();
    const colW = rect.width / DASHBOARD_COLS;
    const col = clamp(Math.floor((px - rect.left) / colW), 0, DASHBOARD_COLS - 1);
    const row = Math.max(0, Math.floor((py - rect.top) / (ROW_H + GAP)));
    return { x: col, y: row };
  }, []);

  /** Ziel für einen Widget-Drag: über echter Gruppe -> interne Zelle, sonst Root. */
  const computeWidgetTarget = useCallback(
    (px: number, py: number): Target | null => {
      const el = document.elementFromPoint(px, py);
      const gridEl = el?.closest("[data-grid-group]") as HTMLElement | null;
      if (gridEl) {
        const groupId = gridEl.getAttribute("data-grid-group")!;
        const group = groups.find((g) => g.id === groupId);
        if (group && !group.ungrouped) {
          const rect = gridEl.getBoundingClientRect();
          const cols = Math.max(1, group.columns);
          const col = clamp(Math.floor((px - rect.left) / (rect.width / cols)), 0, cols - 1);
          const row = Math.max(0, Math.floor((py - rect.top) / (ROW_H + GAP)));
          return { kind: "group", groupId, x: col, y: row };
        }
      }
      const cell = rootCell(px, py);
      return cell ? { kind: "root", x: cell.x, y: cell.y } : null;
    },
    [groups, rootCell],
  );

  const onMove = useCallback(
    (e: TouchEvent | MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      const p = eventPoint(e);
      if (!p) return;
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        setPointer({ x: p.x, y: p.y });
        // Gruppen-Blöcke landen immer im Dashboard-Raster (Root); Widgets ggf. in Gruppen.
        const t: Target | null =
          d.kind === "group"
            ? (() => {
                const c = rootCell(p.x, p.y);
                return c ? { kind: "root", x: c.x, y: c.y } : null;
              })()
            : computeWidgetTarget(p.x, p.y);
        targetRef.current = t;
        setTarget(t);
      });
    },
    [computeWidgetTarget, rootCell],
  );

  const onUp = useCallback(() => {
    const d = dragRef.current;
    const t = targetRef.current;
    if (d && t) {
      if (d.kind === "group") {
        if (t.kind === "root") onMoveBlock?.(d.id, t.x, t.y);
      } else if (t.kind === "group") {
        onPlaceWidget?.(d.id, t.groupId, t.x, t.y);
      } else {
        onPlaceWidgetLoose?.(d.id, t.x, t.y);
      }
    }
    dragRef.current = null;
    targetRef.current = null;
    setDrag(null);
    setTarget(null);
  }, [onMoveBlock, onPlaceWidget, onPlaceWidgetLoose]);

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

  // ---- Resize (Griff unten rechts) — Delta-basiert (auch für lose Widgets) ----
  interface ResizeState {
    groupId: string;
    loose: boolean;
    widget: WidgetConfig;
    startX: number;
    startY: number;
    colW: number;
    maxCols: number;
  }
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [resizeTo, setResizeTo] = useState<{ w: number; h: number } | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const resizeToRef = useRef<{ w: number; h: number } | null>(null);

  const onResizeMove = useCallback((e: TouchEvent | MouseEvent) => {
    const r = resizeRef.current;
    if (!r) return;
    e.preventDefault();
    const p = eventPoint(e);
    if (!p) return;
    const dw = Math.round((p.x - r.startX) / r.colW);
    const dh = Math.round((p.y - r.startY) / (ROW_H + GAP));
    const w = clamp(r.widget.w + dw, 1, r.maxCols);
    const h = Math.max(1, r.widget.h + dh);
    const to = { w, h };
    resizeToRef.current = to;
    setResizeTo(to);
  }, []);

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
    loose: boolean,
    widget: WidgetConfig,
    e: React.TouchEvent | React.MouseEvent,
  ) => {
    e.stopPropagation();
    const p = eventPoint(e.nativeEvent as TouchEvent | MouseEvent);
    if (!p) return;
    const group = groups.find((g) => g.id === groupId);
    const cols = loose ? DASHBOARD_COLS : Math.max(1, group?.columns ?? 6);
    const gridEl = (
      loose
        ? document.querySelector("[data-grid-root]")
        : document.querySelector(`[data-grid-group="${groupId}"]`)
    ) as HTMLElement | null;
    const colW = gridEl ? gridEl.getBoundingClientRect().width / cols : 120;
    const state: ResizeState = { groupId, loose, widget, startX: p.x, startY: p.y, colW, maxCols: cols };
    resizeRef.current = state;
    setResize(state);
    setResizeTo({ w: widget.w, h: widget.h });
  };

  const startWidgetDrag = (
    groupId: string,
    widget: WidgetConfig,
    e: React.TouchEvent | React.MouseEvent,
  ) => {
    const tile = (e.currentTarget as HTMLElement).closest(".grid-cell") as HTMLElement | null;
    const p = eventPoint(e.nativeEvent as TouchEvent | MouseEvent);
    if (!tile || !p) return;
    const rect = tile.getBoundingClientRect();
    const state: DragState = {
      kind: "widget",
      id: widget.id,
      fromGroupId: groupId,
      label: "",
      widget,
      offX: p.x - rect.left,
      offY: p.y - rect.top,
      width: rect.width,
      height: rect.height,
    };
    dragRef.current = state;
    setDrag(state);
    setPointer({ x: p.x, y: p.y });
  };

  const startGroupDrag = (group: Group, e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation();
    const section = (e.currentTarget as HTMLElement).closest(".group") as HTMLElement | null;
    const p = eventPoint(e.nativeEvent as TouchEvent | MouseEvent);
    if (!section || !p) return;
    const rect = section.getBoundingClientRect();
    const state: DragState = {
      kind: "group",
      id: group.id,
      fromGroupId: group.id,
      label: group.name || "Gruppe",
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

  const rootRows = dashboardRowCount(groups) + (editMode ? 3 : 0);
  const rootStyle: React.CSSProperties = {
    gridTemplateColumns: `repeat(${DASHBOARD_COLS}, 1fr)`,
    gridAutoRows: `${ROW_H}px`,
    gap: `${GAP}px`,
    minHeight: editMode ? rootRows * (ROW_H + GAP) : undefined,
  };

  /** Eine Widget-Kachel (in Gruppe oder lose) rendern. */
  const renderCell = (ownerGroupId: string, loose: boolean, w: WidgetConfig) => {
    const dragging = drag?.kind === "widget" && drag.id === w.id;
    const cellStyle: React.CSSProperties = {
      gridColumn: `${w.x + 1} / span ${w.w}`,
      gridRow: `${w.y + 1} / span ${w.h}`,
    };
    return (
      <div
        className={`grid-cell${dragging ? " is-dragging" : ""}${editMode ? " is-edit" : ""}${
          loose ? " grid-cell--loose" : ""
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
              onTouchStart={(e) => startWidgetDrag(ownerGroupId, w, e)}
              onMouseDown={(e) => startWidgetDrag(ownerGroupId, w, e)}
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
              onClick={() => onRemoveWidget?.(ownerGroupId, w.id)}
            >
              ✕
            </button>
          </div>
        )}
        <div className="grid-cell__inner">
          <Widget config={w} />
        </div>
        {editMode && (
          <button
            type="button"
            className="resize-handle"
            aria-label="Größe ändern"
            onTouchStart={(e) => startResize(ownerGroupId, loose, w, e)}
            onMouseDown={(e) => startResize(ownerGroupId, loose, w, e)}
          >
            ⤡
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="dashboard-groups" data-grid-root style={rootStyle}>
      {/* Sichtbares Dashboard-Raster: freie Zellen als Drop-Slots (nur Edit-Modus) */}
      {editMode &&
        topLevelEmptyCells(groups, rootRows).map((c) => (
          <div
            className="grid-slot"
            key={`root-slot-${c.x}-${c.y}`}
            style={{ gridColumn: `${c.x + 1} / span 1`, gridRow: `${c.y + 1} / span 1` }}
          />
        ))}

      {/* Drop-Ziel-Markierung auf Dashboard-Ebene */}
      {target?.kind === "root" && (
        <div
          className="grid-target"
          style={{ gridColumn: `${target.x + 1} / span 1`, gridRow: `${target.y + 1} / span 1` }}
        />
      )}

      {/* Resize-Vorschau für lose Widgets (Dashboard-Ebene) */}
      {resize?.loose && resizeTo && (
        <div
          className="grid-target"
          style={{
            gridColumn: `${resize.widget.x + 1} / span ${resizeTo.w}`,
            gridRow: `${resize.widget.y + 1} / span ${resizeTo.h}`,
          }}
        />
      )}

      {/* Echte Gruppen als positionierte Blöcke */}
      {realGroupList.map((group) => {
        // Block-Höhe bleibt exakt = Inhalt (+ Kopf), auch im Edit-Modus, damit der
        // Block im geteilten Raster nicht in die Nachbarzeilen ragt. Neue Zeilen
        // entstehen durch „+ Widget" (Gruppe wächst, Nachbarn weichen per Reflow).
        const rows = rowCount(group);
        const gridStyle: React.CSSProperties = {
          gridTemplateColumns: `repeat(${Math.max(1, group.columns)}, 1fr)`,
          gridAutoRows: `${ROW_H}px`,
          gap: `${GAP}px`,
          minHeight: editMode ? rows * (ROW_H + GAP) : undefined,
        };
        const isTargetGroup = target?.kind === "group" && target.groupId === group.id;
        const blockStyle: React.CSSProperties = {
          gridColumn: `${(group.x ?? 0) + 1} / span ${groupBlockWidth(group)}`,
          gridRow: `${(group.y ?? 0) + 1} / span ${groupBlockHeight(group)}`,
        };
        return (
          <section className="group" key={group.id} style={blockStyle}>
            <GroupHeader
              name={group.name}
              editMode={Boolean(editMode)}
              columns={group.columns}
              onRename={(name) => onRenameGroup?.(group.id, name)}
              onRemove={() => onRemoveGroup?.(group.id)}
              onAddWidget={() => onAddWidget?.(group.id)}
              onSetColumns={(c) => onSetGroupColumns?.(group.id, c)}
              onDragStart={(e) => startGroupDrag(group, e)}
            />
            <div className="dashboard-grid" data-grid-group={group.id} style={gridStyle}>
              {editMode &&
                emptyCells(group, rows).map((c) => (
                  <div
                    className="grid-slot"
                    key={`slot-${group.id}-${c.x}-${c.y}`}
                    style={{ gridColumn: `${c.x + 1} / span 1`, gridRow: `${c.y + 1} / span 1` }}
                  />
                ))}
              {isTargetGroup && target.kind === "group" && (
                <div
                  className="grid-target"
                  style={{
                    gridColumn: `${target.x + 1} / span 1`,
                    gridRow: `${target.y + 1} / span 1`,
                  }}
                />
              )}
              {resize?.groupId === group.id && !resize.loose && resizeTo && (
                <div
                  className="grid-target"
                  style={{
                    gridColumn: `${resize.widget.x + 1} / span ${resizeTo.w}`,
                    gridRow: `${resize.widget.y + 1} / span ${resizeTo.h}`,
                  }}
                />
              )}
              {group.widgets.map((w) => renderCell(group.id, false, w))}
            </div>
          </section>
        );
      })}

      {/* Lose Widgets: gleichwertige Kacheln direkt im Dashboard-Raster */}
      {loose?.widgets.map((w) => renderCell(looseGroupId, true, w))}

      {editMode && (
        <div className="add-row" style={{ gridColumn: "1 / -1" }}>
          <button type="button" className="add-group" onClick={() => onAddWidget?.(UNGROUPED)}>
            + Widget (ohne Gruppe)
          </button>
          <button type="button" className="add-group" onClick={onAddGroup}>
            + Gruppe
          </button>
        </div>
      )}

      {/* Schwebende Kopie am Finger */}
      {drag && (
        <div
          className={`drag-ghost${drag.kind === "group" ? " drag-ghost--group" : ""}`}
          style={{
            left: pointer.x - drag.offX,
            top: pointer.y - drag.offY,
            width: drag.width,
            height: drag.height,
          }}
        >
          {drag.kind === "widget" && drag.widget ? (
            <Widget config={drag.widget} />
          ) : (
            <span className="drag-ghost__label">{drag.label}</span>
          )}
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
