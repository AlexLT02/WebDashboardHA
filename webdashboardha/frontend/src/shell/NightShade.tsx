import { useEffect, useState } from "react";
import { isNight } from "../state/night";
import type { BoardSettings } from "../state/useBoard";

interface Props {
  settings: BoardSettings;
}

const CHECK_MS = 15000; // Minutengenau reicht — der Übergang macht den Rest.

/**
 * Abdunklung im Nachtfenster. Liegt als transparente Ebene über allem
 * (`pointer-events: none`), damit die Bedienung unverändert bleibt.
 *
 * Der weiche Verlauf kommt aus einer CSS-Transition, nicht aus einem Timer:
 * das läuft im Compositor und kostet das iPad Air 1 nichts.
 *
 * Geblendet wird nur beim Überqueren einer Fenstergrenze im laufenden Betrieb.
 * Frisch geladene oder gerade geänderte Einstellungen greifen sofort — sonst
 * stünde das Dashboard nach einem Neustart um 3 Uhr nachts erst mal hell da und
 * würde über die volle Übergangsdauer nachdunkeln.
 */
export function NightShade({ settings }: Props) {
  const { night: enabled, nightStart, nightEnd, nightDim, nightFadeSec } = settings;
  const [active, setActive] = useState(false);
  const [instant, setInstant] = useState(true);

  useEffect(() => {
    setInstant(true);
    setActive(enabled && isNight(nightStart, nightEnd, new Date()));
    const timer = window.setInterval(() => {
      // Ab dem ersten Tick sind Änderungen echte Zeitwechsel → mit Blende.
      setInstant(false);
      setActive(enabled && isNight(nightStart, nightEnd, new Date()));
    }, CHECK_MS);
    return () => window.clearInterval(timer);
  }, [enabled, nightStart, nightEnd]);

  // Nie ganz auf 1: ein komplett schwarzes Display wirkt wie „kaputt“.
  const opacity = active ? Math.max(0, Math.min(0.95, nightDim)) : 0;

  return (
    <div
      className="nightshade"
      style={{
        opacity,
        transitionDuration: instant ? "0s" : `${Math.max(0, nightFadeSec)}s`,
      }}
    />
  );
}
