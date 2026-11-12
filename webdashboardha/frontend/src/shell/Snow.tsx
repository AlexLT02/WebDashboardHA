import { useEffect, useState } from "react";
import { isNight } from "../state/night";
import { now } from "../state/clock";
import type { Settings, SnowMode } from "../state/useSettings";
import "./Snow.css";

const FLAKES = 24;
const CHECK_MS = 60000;

/** Auto = December to February, and never with reduced motion (04 §6 P8). */
export function snowActive(mode: SnowMode, date: Date, reducedMotion: boolean): boolean {
  if (mode === "off") return false;
  if (mode === "on") return true;
  const m = date.getMonth();
  return (m === 11 || m === 0 || m === 1) && !reducedMotion;
}

function prefersReducedMotion(): boolean {
  return !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface Flake {
  left: number;
  size: number;
  dur: number;
  delay: number;
  drift: number;
}

/** Random once per mount; afterwards only CSS animates (transform/opacity). */
function makeFlakes(): Flake[] {
  const list: Flake[] = [];
  for (let i = 0; i < FLAKES; i++) {
    const dur = 12 + Math.random() * 13;
    list.push({
      left: Math.random() * 100,
      size: 8 + Math.round(Math.random() * 8),
      dur,
      delay: -Math.random() * dur,
      drift: i % 3,
    });
  }
  return list;
}

function Glyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <g stroke="rgba(236,238,242,.55)" strokeWidth="1.6" strokeLinecap="round">
        <line x1="8" y1="1" x2="8" y2="15" />
        <line x1="1.9" y1="4.5" x2="14.1" y2="11.5" />
        <line x1="1.9" y1="11.5" x2="14.1" y2="4.5" />
      </g>
    </svg>
  );
}

/**
 * Snowfall (P8): one fixed, click-through layer under popups and night shade.
 * Off renders nothing; inside the night window the layer is display:none.
 */
export function Snow({ settings }: { settings: Settings }) {
  const { snow, night, nightStart, nightEnd } = settings;
  const [tick, setTick] = useState(0);
  const [flakes] = useState(makeFlakes);

  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), CHECK_MS);
    return () => window.clearInterval(t);
  }, []);

  const date = new Date(now());
  void tick;
  if (!snowActive(snow, date, prefersReducedMotion())) return null;
  const hidden = night && isNight(nightStart, nightEnd, date);

  return (
    <div className="snow" style={hidden ? { display: "none" } : undefined} aria-hidden="true">
      {flakes.map((f, i) => (
        <i
          key={i}
          className={`snow__f snow__f--d${f.drift}`}
          style={{ left: `${f.left}%`, animationDuration: `${f.dur.toFixed(1)}s`, animationDelay: `${f.delay.toFixed(1)}s` }}
        >
          <Glyph size={f.size} />
        </i>
      ))}
    </div>
  );
}
