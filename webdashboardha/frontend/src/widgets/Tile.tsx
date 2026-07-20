import { useEntity } from "../state/store";
import { callService } from "../state/service";
import { displayName, sensorStateLabel } from "../state/display";
import { domainOf, withAlpha, ACCENT_WARM, ACCENT_COOL } from "../state/board";
import { resolveIcon } from "../controls/icons";
import { useLongPress } from "../controls/useLongPress";
import type { WidgetConfig } from "../state/dashboards";
import "./Tile.css";

export type DetailKind = "light" | "media" | "info";

interface Props {
  widget: WidgetConfig;
  editMode: boolean;
  onOpen: (widget: WidgetConfig, kind: DetailKind) => void;
  onRemove: (widgetId: string) => void;
  onAction?: (text: string, color: string) => void;
}

interface TileVM {
  active: boolean;
  sub: string;
  accent: string | null;
  detail: DetailKind;
  onTap: (() => void) | null;
}

/** Kachel-Zustand aus Entity + Domain ableiten (Service-Wiring inklusive). */
function useTileVM(widget: Props["widget"], name: string, onAction?: Props["onAction"]): TileVM {
  const entity = useEntity(widget.entity_id);
  const domain = domainOf(widget);
  const attrs = entity?.attributes ?? {};
  const state = entity?.state;

  const svc = (d: string, service: string, data?: Record<string, unknown>) =>
    callService({ domain: d, service, entity_id: widget.entity_id, data }).catch(console.error);
  const log = (verb: string, color: string) => onAction?.(`${name} ${verb}`, color);

  if (!entity) {
    return { active: false, sub: "nicht verfügbar", accent: null, detail: "info", onTap: null };
  }

  if (domain === "light") {
    const on = state === "on";
    const bri = typeof attrs.brightness === "number" ? attrs.brightness : 0;
    const pct = Math.round((bri / 255) * 100);
    const rgb = Array.isArray(attrs.rgb_color) ? (attrs.rgb_color as number[]) : null;
    const accent = on ? (rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : ACCENT_WARM) : null;
    return {
      active: on,
      sub: on ? (bri ? `Ein · ${pct}%` : "Ein") : "Aus",
      accent,
      detail: "light",
      onTap: () => {
        svc("light", on ? "turn_off" : "turn_on");
        log(on ? "ausgeschaltet" : "eingeschaltet", on ? "#6b7280" : ACCENT_WARM);
      },
    };
  }

  if (domain === "media_player") {
    const playing = state === "playing";
    const on = playing || state === "paused" || state === "on" || state === "buffering";
    const title = (attrs.media_title as string) || (playing ? "Läuft" : "Pausiert");
    return {
      active: on,
      sub: on ? title : "Aus",
      accent: on ? ACCENT_COOL : null,
      detail: "media",
      onTap: () => svc("media_player", "media_play_pause"),
    };
  }

  if (domain === "cover") {
    const open = state === "open" || state === "opening";
    return {
      active: open,
      sub: open ? "Offen" : "Geschlossen",
      accent: open ? ACCENT_COOL : null,
      detail: "info",
      onTap: () => {
        svc("cover", open ? "close_cover" : "open_cover");
        log(open ? "geschlossen" : "geöffnet", ACCENT_COOL);
      },
    };
  }

  if (domain === "sensor" || domain === "binary_sensor" || domain === "weather") {
    return {
      active: false,
      sub: sensorStateLabel(entity),
      accent: null,
      detail: "info",
      onTap: null, // Sensoren öffnen per Tap ihren Info-Dialog (siehe unten)
    };
  }

  // switch / input_boolean / fan / sonstige schaltbare
  const on = state === "on";
  return {
    active: on,
    sub: on ? "Ein" : "Aus",
    accent: on ? ACCENT_WARM : null,
    detail: "info",
    onTap: () => {
      svc(domain || "switch", on ? "turn_off" : "turn_on");
      log(on ? "ausgeschaltet" : "eingeschaltet", on ? "#6b7280" : ACCENT_WARM);
    },
  };
}

export function Tile({ widget, editMode, onOpen, onRemove, onAction }: Props) {
  const entity = useEntity(widget.entity_id);
  const domain = domainOf(widget);
  const name = displayName(widget, entity);
  const Icon = resolveIcon(
    widget.options?.icon as string,
    domain || widget.type,
    entity?.attributes.device_class as string,
    name,
  );
  const vm = useTileVM(widget, name, onAction);

  const isSensor = domain === "sensor" || domain === "binary_sensor" || domain === "weather";
  const openDetail = () => onOpen(widget, vm.detail);
  // Sensor: Tap öffnet den Info-Dialog; sonst schaltet Tap.
  const tap = isSensor ? openDetail : vm.onTap;

  const press = useLongPress({
    onTap: () => {
      if (editMode) return;
      tap?.();
    },
    onLongPress: () => {
      if (editMode) return;
      openDetail();
    },
    delay: 300,
  });

  const { accent } = vm;
  const tileStyle: React.CSSProperties = accent
    ? {
        background: `linear-gradient(160deg, ${withAlpha(accent, 0.18)}, ${withAlpha(accent, 0.05)})`,
        borderColor: withAlpha(accent, 0.28),
        boxShadow: `0 8px 22px -8px ${withAlpha(accent, 0.5)}`,
      }
    : {};
  const badgeStyle: React.CSSProperties = accent
    ? { background: accent, color: "#1a1206", boxShadow: `0 4px 14px ${withAlpha(accent, 0.45)}` }
    : {};
  const subStyle: React.CSSProperties = accent ? { color: withAlpha(accent, 0.92) } : {};

  return (
    <div
      className={`tile${vm.active ? " is-active" : ""}${entity ? "" : " is-unavailable"}`}
      style={tileStyle}
      {...(editMode ? {} : press)}
    >
      {editMode && (
        <button
          type="button"
          className="tile__remove"
          aria-label={`${name} entfernen`}
          onClick={() => onRemove(widget.id)}
        >
          ✕
        </button>
      )}
      <span className="tile__badge" style={badgeStyle}>
        <Icon size={23} />
      </span>
      <div className="tile__body">
        <div className="tile__name" style={editMode ? { paddingRight: 24 } : undefined}>
          {name}
        </div>
        <div className="tile__sub" style={subStyle}>
          {vm.sub}
        </div>
      </div>
    </div>
  );
}
