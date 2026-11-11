import { useState } from "react";
import { Dialog } from "../Dialog";
import { DragBar } from "../../controls/DragBar";
import { Press } from "../../controls/Press";
import { fire, toggleItem } from "../../state/commands";
import { briPct, parseNum } from "../../state/format";
import { timeoutFor, usePend, withinTolerance } from "../../state/pending";
import { lightHeadState } from "../../state/tileState";
import { useBoard, useEntity, useLastColor, useLastTemp } from "../../state/store";
import { useTileView } from "../../widgets/useTileView";
import { footText } from "./common";
import type { Item } from "../../state/model";

/** The 12 swatches of the 1.4.2 dialog (hue, saturation). */
export const SWATCHES: { css: string; hs: [number, number] }[] = [
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

const QUICK_PCT = [10, 30, 60, 100];
const COLOR_MODES = ["hs", "xy", "rgb", "rgbw", "rgbww"];

function clampK(k: number, ct: [number, number]): number {
  return Math.max(ct[0], Math.min(ct[1], k));
}

/**
 * Licht (04 §5.5): brightness big + 56 px bar + 10/30/60/100. With white tone
 * and colour a "Weiß | Farbe" switch, only one control visible. Local devices
 * get a value every 300 ms while dragging, cloud lamps only on release.
 */
export function LightPopup({ item, name }: { item: Item; name?: string }) {
  const board = useBoard();
  const st = useEntity(item.id);
  const view = useTileView(item);
  const pend = usePend(item.id);
  const lastColor = useLastColor(item.id);
  const lastTemp = useLastTemp(item.id);
  const f = item.features || {};
  const offline = !st || st.state === "unavailable";
  const on = st?.state === "on";
  const bri = parseNum(st?.attributes.brightness);
  const ct = f.ct;
  const hasColor = !!f.color;
  const [mode, setMode] = useState<"weiss" | "farbe">(() => {
    const cm = st?.attributes.color_mode;
    return hasColor && (!ct || (typeof cm === "string" && COLOR_MODES.indexOf(cm) !== -1)) ? "farbe" : "weiss";
  });
  const [briLocal, setBriLocal] = useState<number | null>(null);
  const [kLocal, setKLocal] = useState<number | null>(null);
  const timeout = timeoutFor(item.cloud);
  const throttle = item.cloud ? 0 : 300;

  const send = (data: Record<string, unknown>) => fire({ domain: "light", service: "turn_on", entity_id: item.id, data });

  const briValue = on && bri !== null ? bri / 255 : on ? 1 : 0;
  const shownPct = briLocal !== null ? Math.max(1, Math.round(briLocal * 100)) : on ? (bri ? briPct(bri) : null) : null;
  const curPct = on && bri ? briPct(bri) : -1;

  const liveK = parseNum(st?.attributes.color_temp_kelvin);
  const k = kLocal !== null ? kLocal : liveK !== null ? liveK : lastTemp || (ct ? Math.round((ct[0] + ct[1]) / 2) : 3000);
  const hs = Array.isArray(st?.attributes.hs_color) ? (st?.attributes.hs_color as number[]) : lastColor || [28, 80];

  const pendOn = pend && pend.phase === "wait" ? pend.on : null;
  const headOn = pendOn !== null ? pendOn : on;

  return (
    <Dialog
      name={name || item.name}
      state={offline ? view?.status || "Offline" : lightHeadState(st)}
      stateOn={on}
      badge={{
        icon: item.icon,
        on: headOn,
        offline,
        onToggle: offline || !view ? undefined : () => toggleItem(item, view),
      }}
      foot={footText(board, item, st)}
    >
      {f.brightness !== false ? (
        <>
          <div className="pval">
            <span className="pval__num">
              {shownPct !== null ? (
                <>
                  {shownPct}
                  <small>%</small>
                </>
              ) : (
                "Aus"
              )}
            </span>
            <span className="pval__k">Helligkeit</span>
          </div>
          <DragBar
            mode="fill"
            value={briValue}
            disabled={offline}
            throttleMs={throttle}
            timeoutMs={timeout}
            label={`${name || item.name} Helligkeit`}
            confirm={(t, r) => (t < 0.01 ? !on : withinTolerance("brightness", t * 255, r !== null ? r * 255 : null))}
            onLocal={setBriLocal}
            onCommit={(v) =>
              v < 0.01
                ? fire({ domain: "light", service: "turn_off", entity_id: item.id })
                : send({ brightness: Math.max(1, Math.round(v * 255)) })
            }
          />
          <div className="qchips">
            {QUICK_PCT.map((p) => (
              <Press
                key={p}
                className={`qchip${curPct === p ? " is-sel" : ""}${offline ? " is-disabled" : ""}`}
                disabled={offline}
                onPress={() => send({ brightness_pct: p })}
              >
                {`${p} %`}
              </Press>
            ))}
          </div>
        </>
      ) : null}

      {ct && hasColor ? (
        <div className="seg">
          <Press className={mode === "weiss" ? "is-sel" : ""} onPress={() => setMode("weiss")}>
            Weiß
          </Press>
          <Press className={mode === "farbe" ? "is-sel" : ""} onPress={() => setMode("farbe")}>
            Farbe
          </Press>
        </div>
      ) : null}

      {ct && (mode === "weiss" || !hasColor) ? (
        <>
          <div className="pval pval--sm">
            <span className="pval__num">
              {Math.round(k / 10) * 10}
              <small>K</small>
            </span>
            <span className="pval__k">Weißton</span>
          </div>
          <DragBar
            mode="pick"
            className="bar--k"
            value={(clampK(k, ct) - ct[0]) / Math.max(1, ct[1] - ct[0])}
            disabled={offline}
            throttleMs={throttle}
            timeoutMs={timeout}
            label={`${name || item.name} Weißton`}
            confirm={(t, r) => withinTolerance("kelvin", ct[0] + t * (ct[1] - ct[0]), r !== null ? ct[0] + r * (ct[1] - ct[0]) : null)}
            onLocal={(v) => setKLocal(v === null ? null : Math.round(ct[0] + v * (ct[1] - ct[0])))}
            onCommit={(v) => send({ color_temp_kelvin: Math.round((ct[0] + v * (ct[1] - ct[0])) / 10) * 10 })}
          />
          <div className="qchips qchips--3">
            {[
              ["Warm", 2700],
              ["Neutral", 4000],
              ["Kalt", 6000],
            ].map(([label, kv]) => {
              const target = clampK(kv as number, ct);
              return (
                <Press
                  key={label as string}
                  className={`qchip${offline ? " is-disabled" : ""}`}
                  disabled={offline}
                  onPress={() => send({ color_temp_kelvin: target })}
                >
                  {`${label} ${target}`}
                </Press>
              );
            })}
          </div>
        </>
      ) : null}

      {hasColor && (mode === "farbe" || !ct) ? (
        <>
          <div className="pval pval--sm">
            <span className="pval__num">Farbe</span>
          </div>
          <DragBar
            mode="pick"
            className="bar--hue"
            value={(Number(hs[0]) || 0) / 360}
            disabled={offline}
            throttleMs={throttle}
            timeoutMs={timeout}
            label={`${name || item.name} Farbe`}
            confirm={(t, r) => withinTolerance("hue", t * 360, r !== null ? r * 360 : null)}
            onCommit={(v) => send({ hs_color: [Math.round(v * 360), Math.max(40, Math.round(Number(hs[1]) || 80))] })}
          />
          <div className="swatches">
            {SWATCHES.map((sw) => (
              <Press
                key={sw.css}
                className="swatch"
                style={{ background: sw.css }}
                disabled={offline}
                label="Farbe wählen"
                onPress={() => send({ hs_color: sw.hs })}
              />
            ))}
          </div>
        </>
      ) : null}

      {item.kind === "status_led" ? <div className="popup__note">Warnungen übersteuern die Leiste</div> : null}
    </Dialog>
  );
}
