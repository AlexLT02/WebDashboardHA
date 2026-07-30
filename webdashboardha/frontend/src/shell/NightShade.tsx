import { useEffect, useRef, useState } from "react";
import { isNight } from "../state/night";
import type { BoardSettings } from "../state/useBoard";

interface Props {
  settings: BoardSettings;
}

const CHECK_MS = 15000; // Minutengenau reicht — der Übergang macht den Rest.
const WAKE_IDLE_MS = 60000; // Ruhe bis zurück in den Nachtmodus
const WAKE_FADE = "0.35s"; // Aufhellen beim Antippen: sofort da sein
const SLEEP_FADE = "2.5s"; // Zurück ins Dunkle: sanft, aber nicht minutenlang

/**
 * Abdunklung im Nachtfenster. Liegt als transparente Ebene über allem
 * (`pointer-events: none`), damit die Bedienung unverändert bleibt.
 *
 * Der weiche Verlauf kommt aus einer CSS-Transition, nicht aus einem Timer:
 * das läuft im Compositor und kostet das iPad Air 1 nichts.
 *
 * Drei verschiedene Übergangsdauern, je nach Auslöser:
 * - Fenstergrenze im laufenden Betrieb → die eingestellte Dauer (langsam).
 * - Frisch geladene/geänderte Einstellungen → sofort. Sonst stünde das
 *   Dashboard nach einem Neustart um 3 Uhr nachts erst mal hell da und würde
 *   über die volle Übergangsdauer nachdunkeln.
 * - Antippen → kurz aufhellen, nach einer Minute Ruhe sanft zurück ins Dunkle.
 */
export function NightShade({ settings }: Props) {
  const { night: enabled, nightStart, nightEnd, nightDim, nightFadeSec } = settings;
  const [inWindow, setInWindow] = useState(false);
  const [awake, setAwake] = useState(false);
  const [fade, setFade] = useState("0s");
  const inWindowRef = useRef(false);

  // Zeitfenster überwachen.
  useEffect(() => {
    const current = enabled && isNight(nightStart, nightEnd, new Date());
    inWindowRef.current = current;
    setFade("0s");
    setInWindow(current);

    const timer = window.setInterval(() => {
      const next = enabled && isNight(nightStart, nightEnd, new Date());
      if (next === inWindowRef.current) return;
      inWindowRef.current = next;
      setFade(`${Math.max(0, nightFadeSec)}s`);
      setInWindow(next);
    }, CHECK_MS);
    return () => window.clearInterval(timer);
  }, [enabled, nightStart, nightEnd, nightFadeSec]);

  // Antippen hellt auf; nach WAKE_IDLE_MS ohne Bedienung wird wieder abgedunkelt.
  // Listener nur im Nachtfenster — tagsüber gibt es nichts aufzuhellen.
  useEffect(() => {
    if (!inWindow) {
      setAwake(false);
      return;
    }
    let timer = 0;
    const sleep = () => {
      setFade(SLEEP_FADE);
      setAwake(false);
    };
    const wake = () => {
      setFade(WAKE_FADE);
      setAwake(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(sleep, WAKE_IDLE_MS);
    };
    window.addEventListener("mousedown", wake);
    window.addEventListener("touchstart", wake, { passive: true });
    window.addEventListener("keydown", wake);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("mousedown", wake);
      window.removeEventListener("touchstart", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [inWindow]);

  // Nie ganz auf 1: ein komplett schwarzes Display wirkt wie „kaputt“.
  const opacity = inWindow && !awake ? Math.max(0, Math.min(0.95, nightDim)) : 0;

  return <div className="nightshade" style={{ opacity, transitionDuration: fade }} />;
}
