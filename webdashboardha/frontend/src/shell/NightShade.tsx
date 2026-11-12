import { useEffect, useRef, useState } from "react";
import { isNight } from "../state/night";
import { useStore } from "../state/store";
import { useUi } from "../state/ui";
import { now } from "../state/clock";
import type { Settings } from "../state/useSettings";

interface Props {
  settings: Settings;
}

const CHECK_MS = 15000;
const WAKE_MS = 30000;
const DOOR_WAKE_MS = 60000;
const WAKE_FADE = "0.35s";
const SLEEP_FADE = "2.5s";

/**
 * Night shade v2 (04 §5.6, D13). Two fixed layers, only their opacity changes:
 * - sleep: four static rectangles (head and, on Start, the Lage column 50 %;
 *   rail and the rest 85 %). It catches the first touch (native touchend with
 *   preventDefault), so a tap in the dark never switches anything;
 * - wake: an even 35 % for 30 s after the last touch, back in 2.5 s.
 * The entrance door opening at night wakes it for 60 s without swallowing.
 */
export function NightShade({ settings }: Props) {
  const { night: enabled, nightStart, nightEnd } = settings;
  const [inWindow, setInWindow] = useState(false);
  const [awake, setAwake] = useState(false);
  const [fade, setFade] = useState("0s");
  const layerRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef(0);
  const onStart = useUi((s) => s.screen.t === "start");
  const door = useStore((s) => (s.board?.door_reset ? s.states[s.board.door_reset]?.state : undefined));

  const inRef = useRef<boolean | null>(null);

  useEffect(() => {
    // Fresh load or changed settings: jump, so a reload at 3 am starts dark.
    inRef.current = null;
    const check = () => {
      const next = enabled && isNight(nightStart, nightEnd, new Date(now()));
      if (next === inRef.current) return;
      setFade(inRef.current === null ? "0s" : SLEEP_FADE);
      inRef.current = next;
      setInWindow(next);
    };
    check();
    const t = window.setInterval(check, CHECK_MS);
    return () => window.clearInterval(t);
  }, [enabled, nightStart, nightEnd]);

  const wake = (ms: number) => {
    setFade(WAKE_FADE);
    setAwake(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setFade(SLEEP_FADE);
      setAwake(false);
    }, ms);
  };

  // Sleeping: the layer takes the first touch and swallows it.
  useEffect(() => {
    const el = layerRef.current;
    if (!el || !inWindow || awake) return;
    const swallow = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      wake(WAKE_MS);
    };
    el.addEventListener("touchend", swallow, { passive: false });
    el.addEventListener("mouseup", swallow);
    return () => {
      el.removeEventListener("touchend", swallow);
      el.removeEventListener("mouseup", swallow);
    };
  }, [inWindow, awake]);

  // Awake: every touch extends the 30 s.
  useEffect(() => {
    if (!inWindow || !awake) return;
    const extend = () => wake(WAKE_MS);
    window.addEventListener("touchstart", extend, { passive: true });
    window.addEventListener("mousedown", extend);
    return () => {
      window.removeEventListener("touchstart", extend);
      window.removeEventListener("mousedown", extend);
    };
  }, [inWindow, awake]);

  useEffect(() => {
    if (inWindow && door === "on") wake(DOOR_WAKE_MS);
  }, [door, inWindow]);

  useEffect(() => {
    if (!inWindow) {
      window.clearTimeout(timer.current);
      setAwake(false);
    }
  }, [inWindow]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!enabled) return null;
  const sleeping = inWindow && !awake;
  return (
    <>
      <div
        ref={layerRef}
        className={`night night--sleep${onStart ? " is-start" : ""}`}
        style={{ opacity: sleeping ? 1 : 0, pointerEvents: sleeping ? "auto" : "none", transitionDuration: fade }}
      >
        <i className="night__r night__rail" />
        <i className="night__r night__head" />
        <i className="night__r night__lage" />
        <i className="night__r night__rest" />
      </div>
      <div className="night night--wake" style={{ opacity: inWindow && awake ? 1 : 0, transitionDuration: fade }} />
    </>
  );
}
