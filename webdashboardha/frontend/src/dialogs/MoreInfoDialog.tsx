import { useState } from "react";
import { useEntity, useLastColor, useLastTemp } from "../state/store";
import { callService } from "../state/service";
import { displayName, sensorStateLabel } from "../state/display";
import { domainOf, withAlpha, ACCENT_WARM } from "../state/board";
import { resolveIcon } from "../controls/icons";
import { DragBar } from "../controls/DragBar";
import { Dialog } from "./Dialog";
import type { DetailKind } from "../widgets/Tile";
import type { WidgetConfig } from "../state/dashboards";

interface Props {
  widget: WidgetConfig;
  kind: DetailKind;
  onClose: () => void;
  onUpdateOptions: (widgetId: string, patch: Record<string, unknown>) => void;
}

const COLOR_MODES = ["hs", "rgb", "rgbw", "rgbww", "xy"];
function supportsColor(a: Record<string, unknown>): boolean {
  const m = a.supported_color_modes;
  return Array.isArray(m) && m.some((x) => COLOR_MODES.includes(String(x)));
}
function supportsBrightness(a: Record<string, unknown>): boolean {
  const m = a.supported_color_modes;
  if (Array.isArray(m) && m.some((x) => x !== "onoff")) return true;
  return a.brightness !== undefined;
}
function supportsWhite(a: Record<string, unknown>): boolean {
  const m = a.supported_color_modes;
  return Array.isArray(m) && m.some((x) => String(x) === "color_temp");
}

const HUE_GRADIENT =
  "linear-gradient(90deg,#ff5a5a,#ffd24c,#4cd07d,#4ce0d0,#4c8dff,#a97bff,#ff6ac2,#ff5a5a)";
const CT_GRADIENT = "linear-gradient(90deg,#ffd39a,#fff3e2,#ffffff,#eaf2ff,#cfe0ff)";
const BRI_GRADIENT = "linear-gradient(90deg,rgba(239,147,107,0.5),#ef936b)";

const SWATCHES: { css: string; hs: [number, number] }[] = [
  { css: "hsl(34,60%,74%)", hs: [34, 60] },
  { css: "hsl(210,45%,84%)", hs: [210, 45] },
  { css: "hsl(2,80%,62%)", hs: [2, 80] },
  { css: "hsl(24,85%,60%)", hs: [24, 85] },
  { css: "hsl(46,88%,60%)", hs: [46, 88] },
  { css: "hsl(140,52%,55%)", hs: [140, 52] },
  { css: "hsl(174,58%,52%)", hs: [174, 58] },
  { css: "hsl(210,80%,62%)", hs: [210, 80] },
  { css: "hsl(256,62%,66%)", hs: [256, 62] },
  { css: "hsl(320,68%,66%)", hs: [320, 68] },
  { css: "hsl(300,55%,60%)", hs: [300, 55] },
  { css: "hsl(96,50%,55%)", hs: [96, 50] },
];

/** Alias-Eingabe: lokal tippen, beim Verlassen (oder Enter) persistieren. */
function AliasField({ widget, onUpdateOptions }: Pick<Props, "widget" | "onUpdateOptions">) {
  const initial = (widget.options?.alias as string) ?? "";
  const [value, setValue] = useState(initial);
  const commit = () => {
    if (value !== initial) onUpdateOptions(widget.id, { alias: value });
  };
  return (
    <>
      <div className="dlg__label">Name (Alias)</div>
      <input
        type="text"
        className="dlg__input"
        value={value}
        placeholder={widget.title ?? widget.entity_id}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
      />
      <div className="dlg__gap" />
    </>
  );
}

export function MoreInfoDialog({ widget, kind, onClose, onUpdateOptions }: Props) {
  const entity = useEntity(widget.entity_id);
  const lastColor = useLastColor(widget.entity_id);
  const lastTemp = useLastTemp(widget.entity_id);
  const name = displayName(widget, entity);
  const domain = domainOf(widget);

  const svc = (d: string, service: string, data?: Record<string, unknown>) =>
    callService({ domain: d, service, entity_id: widget.entity_id, data }).catch(console.error);

  // ---------- LIGHT ----------
  if (kind === "light") {
    const attrs = entity?.attributes ?? {};
    const on = entity?.state === "on";
    const bri = typeof attrs.brightness === "number" ? attrs.brightness : on ? 255 : 0;
    const pct = Math.round((bri / 255) * 100);
    const rgb = Array.isArray(attrs.rgb_color) ? (attrs.rgb_color as number[]) : null;
    const accent = on ? (rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : ACCENT_WARM) : ACCENT_WARM;
    const Icon = resolveIcon(widget.options?.icon as string, "light", undefined, name);

    const hasBri = supportsBrightness(attrs);
    const hasColor = supportsColor(attrs);
    const hasWhite = supportsWhite(attrs);

    const liveHs =
      Array.isArray(attrs.hs_color) && (attrs.hs_color as number[])[1] > 0
        ? (attrs.hs_color as number[])
        : null;
    const hs = liveHs ?? lastColor ?? [28, 80];
    const huePos = (hs[0] / 360) * 100;

    const minK = typeof attrs.min_color_temp_kelvin === "number" ? attrs.min_color_temp_kelvin : 2200;
    const maxK = typeof attrs.max_color_temp_kelvin === "number" ? attrs.max_color_temp_kelvin : 6500;
    const liveK = typeof attrs.color_temp_kelvin === "number" ? attrs.color_temp_kelvin : null;
    const curK = liveK ?? lastTemp ?? (minK + maxK) / 2;
    const ctVal = Math.max(0, Math.min(1, (curK - minK) / (maxK - minK)));

    return (
      <Dialog title={name} onClose={onClose}>
        <AliasField widget={widget} onUpdateOptions={onUpdateOptions} />

        <div className="dlg__toggle-row">
          <span
            className="dlg__icon"
            style={{
              background: on ? accent : "#232833",
              color: on ? "#1a1206" : "#8b92a0",
              boxShadow: on ? `0 6px 20px ${withAlpha(accent, 0.45)}` : "none",
            }}
          >
            <Icon size={28} />
          </span>
          <button
            type="button"
            className="dlg__toggle-btn"
            style={{
              background: on ? ACCENT_WARM : "#2a2f3a",
              color: on ? "#1a1206" : "#c3c9d4",
            }}
            onClick={() => svc("light", on ? "turn_off" : "turn_on")}
          >
            {on ? "An" : "Aus"}
          </button>
        </div>
        <div className="dlg__gap" />

        {hasBri && (
          <>
            <div className="dlg__label">Helligkeit · {pct}%</div>
            <DragBar
              mode="fill"
              gradient={BRI_GRADIENT}
              value={bri / 255}
              aria-label={`${name} Helligkeit`}
              onChange={(v) =>
                svc("light", "turn_on", { brightness: Math.max(1, Math.round(v * 255)) })
              }
            />
            <div className="dlg__gap" />
          </>
        )}

        {hasWhite && (
          <>
            <div className="dlg__label">Weißton · {Math.round(curK)} K</div>
            <DragBar
              mode="pick"
              gradient={CT_GRADIENT}
              height={24}
              value={ctVal}
              aria-label={`${name} Weißton`}
              onChange={(v) =>
                svc("light", "turn_on", { color_temp_kelvin: Math.round(minK + v * (maxK - minK)) })
              }
            />
            <div className="dlg__gap" />
          </>
        )}

        {hasColor && (
          <>
            <div className="dlg__label">Farbe</div>
            <DragBar
              mode="pick"
              gradient={HUE_GRADIENT}
              height={24}
              value={huePos / 100}
              aria-label={`${name} Farbe`}
              onChange={(v) => svc("light", "turn_on", { hs_color: [Math.round(v * 360), 80] })}
            />
            <div className="dlg__gap--sm" />
            <div className="dlg__swatches">
              {SWATCHES.map((sw) => (
                <button
                  key={sw.css}
                  type="button"
                  className="dlg__swatch"
                  style={{ background: sw.css }}
                  aria-label="Farbe wählen"
                  onClick={() => svc("light", "turn_on", { hs_color: sw.hs })}
                />
              ))}
            </div>
          </>
        )}
      </Dialog>
    );
  }

  // ---------- MEDIA ----------
  if (kind === "media") {
    const attrs = entity?.attributes ?? {};
    const playing = entity?.state === "playing";
    const title = (attrs.media_title as string) || name;
    const artist = (attrs.media_artist as string) || "";
    const album = (attrs.media_album_name as string) || "";
    const sources = (attrs.source_list as string[] | undefined) ?? [];
    const current = attrs.source as string | undefined;

    return (
      <Dialog title={name} onClose={onClose}>
        <AliasField widget={widget} onUpdateOptions={onUpdateOptions} />

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#f3f5f8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title}
          </div>
          {artist && <div style={{ fontSize: 14, color: "#9aa2b1" }}>{artist}</div>}
          {album && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{album}</div>}
        </div>

        <div className="dlg__transport">
          <button type="button" className="dlg__mbtn" aria-label="Zurück" onClick={() => svc("media_player", "media_previous_track")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3 6 9 6V6z" /></svg>
          </button>
          <button type="button" className="dlg__mbtn dlg__mbtn--play" aria-label={playing ? "Pause" : "Wiedergabe"} onClick={() => svc("media_player", "media_play_pause")}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d={playing ? "M6 5h4v14H6zM14 5h4v14h-4z" : "M8 5v14l11-7z"} /></svg>
          </button>
          <button type="button" className="dlg__mbtn" aria-label="Weiter" onClick={() => svc("media_player", "media_next_track")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M15 6h2v12h-2zM6 6l9 6-9 6z" /></svg>
          </button>
        </div>

        {sources.length > 0 && (
          <>
            <div className="dlg__gap" />
            <div className="dlg__label">Ausgabe</div>
            {sources.map((s) => (
              <button
                key={s}
                type="button"
                className={`dlg__source${s === current ? " is-sel" : ""}`}
                onClick={() => svc("media_player", "select_source", { source: s })}
              >
                {s}
              </button>
            ))}
          </>
        )}
      </Dialog>
    );
  }

  // ---------- INFO / SENSOR / schaltbar ----------
  const isSensor = domain === "sensor" || domain === "binary_sensor" || domain === "weather";
  const toggleable = ["switch", "input_boolean", "fan"].includes(domain);
  const isCover = domain === "cover";
  const on = entity?.state === "on";
  const coverOpen = entity?.state === "open" || entity?.state === "opening";
  const unit = (entity?.attributes.unit_of_measurement as string) || "";

  return (
    <Dialog title={name} onClose={onClose}>
      {isSensor && entity && (
        <div className="dlg__big">
          <div className="dlg__big-val">{`${entity.state}${unit ? " " + unit : ""}`}</div>
          <div className="dlg__big-sub">{sensorStateLabel(entity)}</div>
        </div>
      )}

      <AliasField widget={widget} onUpdateOptions={onUpdateOptions} />

      {(toggleable || isCover) && (
        <>
          <div className="dlg__setting">
            <div>
              <div className="dlg__setting-t">{isCover ? "Öffnen / Schließen" : "Schalten"}</div>
              <div className="dlg__setting-d">
                {isCover ? (coverOpen ? "Offen" : "Geschlossen") : on ? "Ein" : "Aus"}
              </div>
            </div>
            <button
              type="button"
              className={`dlg__switch${(isCover ? coverOpen : on) ? " is-on" : ""}`}
              aria-label="Schalten"
              onClick={() =>
                isCover
                  ? svc("cover", coverOpen ? "close_cover" : "open_cover")
                  : svc(domain || "switch", on ? "turn_off" : "turn_on")
              }
            >
              <span className="dlg__switch-knob" />
            </button>
          </div>
          <div className="dlg__gap--sm" />
        </>
      )}

      <div className="dlg__row">
        <span className="dlg__row-k">Status</span>
        <span className="dlg__row-v">{entity ? entity.state : "nicht verfügbar"}</span>
      </div>
      <div className="dlg__row">
        <span className="dlg__row-k">Entität</span>
        <span className="dlg__row-v">{widget.entity_id || "—"}</span>
      </div>
      {entity && typeof entity.attributes.device_class === "string" && (
        <div className="dlg__row">
          <span className="dlg__row-k">Klasse</span>
          <span className="dlg__row-v">{entity.attributes.device_class as string}</span>
        </div>
      )}
    </Dialog>
  );
}
