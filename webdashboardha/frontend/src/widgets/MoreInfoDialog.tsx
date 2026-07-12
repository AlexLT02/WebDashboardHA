import { useState } from "react";
import { useEntity, useLastColor } from "../state/store";
import { callService } from "../state/service";
import { useViewport, clampNum } from "../state/useViewport";
import { TouchSlider } from "../controls/TouchSlider";
import { ColorWheel } from "../controls/ColorWheel";
import { PowerIcon, BrightnessIcon, ColorRingIcon } from "../controls/icons";
import "./MoreInfoDialog.css";

const COLOR_MODES = ["hs", "rgb", "rgbw", "rgbww", "xy"];

function supportsColor(attrs: Record<string, unknown>): boolean {
  const modes = attrs.supported_color_modes;
  return Array.isArray(modes) && modes.some((m) => COLOR_MODES.includes(String(m)));
}
function supportsBrightness(attrs: Record<string, unknown>): boolean {
  const modes = attrs.supported_color_modes;
  if (Array.isArray(modes) && modes.some((m) => m !== "onoff")) return true;
  return attrs.brightness !== undefined;
}
function supportsWhite(attrs: Record<string, unknown>): boolean {
  const modes = attrs.supported_color_modes;
  return Array.isArray(modes) && modes.some((m) => String(m) === "color_temp");
}

const PRESETS: { name: string; rgb: [number, number, number] }[] = [
  { name: "Orange", rgb: [255, 138, 0] },
  { name: "Pfirsich", rgb: [255, 176, 102] },
  { name: "Creme", rgb: [255, 214, 160] },
  { name: "Weiß", rgb: [255, 255, 255] },
  { name: "Blau", rgb: [76, 141, 255] },
  { name: "Violett", rgb: [176, 108, 255] },
  { name: "Pink", rgb: [255, 127, 208] },
  { name: "Rot", rgb: [255, 106, 90] },
];

const TEMP_GRADIENT = "linear-gradient(to top, #ff9d43, #ffd9b0, #ffffff, #d6e6ff, #a9ccff)";

type Mode = "brightness" | "color" | "white";

interface Props {
  entityId: string;
  title: string;
  onClose: () => void;
}

export function MoreInfoDialog({ entityId, title, onClose }: Props) {
  const entity = useEntity(entityId);
  const on = entity?.state === "on";
  const attrs = entity?.attributes ?? {};
  const brightness = typeof attrs.brightness === "number" ? attrs.brightness : 0;
  const pct = Math.round((brightness / 255) * 100);
  // Live-Farbe nur, wenn es eine echte ist (Sättigung > 0); sonst letzte bekannte
  // Farbe, damit das Farbrad beim Ausschalten nicht in die Mitte springt.
  const lastColor = useLastColor(entityId);
  const liveHs =
    Array.isArray(attrs.hs_color) && (attrs.hs_color as number[])[1] > 0
      ? (attrs.hs_color as number[])
      : null;
  const hs = liveHs ?? lastColor ?? [0, 0];

  const hasBrightness = supportsBrightness(attrs);
  const hasColor = supportsColor(attrs);
  const hasWhite = supportsWhite(attrs);

  const [mode, setMode] = useState<Mode>(
    hasBrightness ? "brightness" : hasColor ? "color" : "white",
  );

  // Responsive Größen aus dem Viewport (Safari 12 hat kein CSS clamp/min/max).
  const vp = useViewport();
  const barWidth = Math.round(clampNum(vp.width * 0.28, 92, 128));
  const barHeight = Math.round(clampNum(vp.height * 0.36, 170, 280));
  const wheelSize = Math.round(clampNum(Math.min(vp.width * 0.6, vp.height * 0.38), 150, 240));

  // Weißtemperatur (Kelvin).
  const minK = typeof attrs.min_color_temp_kelvin === "number" ? attrs.min_color_temp_kelvin : 2000;
  const maxK = typeof attrs.max_color_temp_kelvin === "number" ? attrs.max_color_temp_kelvin : 6500;
  const curK = typeof attrs.color_temp_kelvin === "number" ? attrs.color_temp_kelvin : (minK + maxK) / 2;
  const tempValue = clampNum((curK - minK) / (maxK - minK), 0, 1);

  const togglePower = () =>
    callService({
      domain: "light",
      service: on ? "turn_off" : "turn_on",
      entity_id: entityId,
    }).catch(console.error);

  const setBrightness = (v: number) =>
    callService({
      domain: "light",
      service: "turn_on",
      entity_id: entityId,
      data: { brightness: Math.max(1, Math.round(v * 255)) },
    }).catch(console.error);

  const setColor = (h: number, s: number) =>
    callService({
      domain: "light",
      service: "turn_on",
      entity_id: entityId,
      data: { hs_color: [Math.round(h), Math.round(s)] },
    }).catch(console.error);

  const setPreset = (rgb: [number, number, number]) =>
    callService({
      domain: "light",
      service: "turn_on",
      entity_id: entityId,
      data: { rgb_color: rgb },
    }).catch(console.error);

  const setTemp = (v: number) =>
    callService({
      domain: "light",
      service: "turn_on",
      entity_id: entityId,
      data: { color_temp_kelvin: Math.round(minK + v * (maxK - minK)) },
    }).catch(console.error);

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__header">
          <button type="button" className="dialog__close" aria-label="Schließen" onClick={onClose}>
            ✕
          </button>
          <h2 className="dialog__title">{title}</h2>
          <span />
        </div>

        <div className="dialog__state">{on ? `Ein · ${pct}%` : "Aus"}</div>

        {/* Zentraler Regler je nach Modus */}
        <div className="dialog__control">
          {mode === "brightness" && hasBrightness && (
            <TouchSlider
              value={brightness / 255}
              onChange={setBrightness}
              width={barWidth}
              height={barHeight}
              aria-label={`${title} Helligkeit`}
            />
          )}
          {mode === "color" && hasColor && (
            <ColorWheel hue={hs[0]} saturation={hs[1]} onChange={setColor} size={wheelSize} />
          )}
          {mode === "white" && hasWhite && (
            <TouchSlider
              value={tempValue}
              onChange={setTemp}
              width={barWidth}
              height={barHeight}
              trackGradient={TEMP_GRADIENT}
              aria-label={`${title} Weißtemperatur`}
            />
          )}
        </div>

        {/* Modus-Umschalter (Pille) */}
        <div className="mode-pill">
          <button
            type="button"
            className={`mode-pill__btn${on ? " is-on" : ""}`}
            onClick={togglePower}
            aria-label={on ? "Ausschalten" : "Einschalten"}
          >
            <PowerIcon size={20} />
          </button>
          {hasBrightness && (
            <button
              type="button"
              className={`mode-pill__btn${mode === "brightness" ? " is-active" : ""}`}
              onClick={() => setMode("brightness")}
              aria-label="Helligkeit"
            >
              <BrightnessIcon size={20} />
            </button>
          )}
          {hasColor && (
            <button
              type="button"
              className={`mode-pill__btn${mode === "color" ? " is-active" : ""}`}
              onClick={() => setMode("color")}
              aria-label="Farbe"
            >
              <ColorRingIcon size={22} />
            </button>
          )}
          {hasWhite && (
            <button
              type="button"
              className={`mode-pill__btn mode-pill__w${mode === "white" ? " is-active" : ""}`}
              onClick={() => setMode("white")}
              aria-label="Weißtemperatur"
            >
              W
            </button>
          )}
        </div>

        {/* Farb-Presets (im Farbmodus) */}
        {mode === "color" && hasColor && (
          <div className="dialog__presets">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                className="dialog__swatch"
                style={{ background: `rgb(${p.rgb[0]}, ${p.rgb[1]}, ${p.rgb[2]})` }}
                aria-label={p.name}
                onClick={() => setPreset(p.rgb)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
