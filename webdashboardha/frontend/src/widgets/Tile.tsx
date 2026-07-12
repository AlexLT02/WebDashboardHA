import type { ComponentType } from "react";
import { useLongPress } from "../controls/useLongPress";
import "./Tile.css";

interface Props {
  icon: ComponentType<{ size?: number }>;
  title: string;
  subtitle?: string;
  active?: boolean;
  /** Optionale Akzentfarbe (z. B. echte Lampenfarbe) fürs aktive Badge. */
  accent?: string;
  unavailable?: boolean;
  /** Größer dargestellt (Widget ist >1 Zelle) → zentriertes Layout mit größerem Icon. */
  big?: boolean;
  /** Rasterhöhe (Zeilen) — skaliert Icon/Schrift bei größeren Kacheln mit. */
  gridH?: number;
  /** Kurzes Tippen (z. B. an/aus schalten). */
  onTap?: () => void;
  /** Halten (0,3 s) → Detail-Dialog. */
  onLongPress?: () => void;
}

/**
 * Kompakte HA-artige Kachel. Ganze Kachel reagiert: Tippen = onTap,
 * Halten (1s) = onLongPress. Ohne Handler nicht interaktiv (z. B. Sensor).
 */
export function Tile({
  icon: Icon,
  title,
  subtitle,
  active,
  accent,
  unavailable,
  big,
  gridH = 1,
  onTap,
  onLongPress,
}: Props) {
  const interactive = Boolean(onTap || onLongPress) && !unavailable;
  const press = useLongPress({
    onTap: () => onTap?.(),
    onLongPress: () => onLongPress?.(),
    delay: 300,
  });
  const handlers = interactive ? press : {};

  const badgeStyle =
    active && accent ? { background: accent, color: "#fff" } : undefined;

  // Bei größeren Kacheln Icon/Schrift mit der Höhe hochskalieren.
  const boxH = gridH * 76 + (gridH - 1) * 10;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
  const iconSize = big ? Math.round(clamp(boxH * 0.3, 30, 120)) : 22;
  const titleStyle = big ? { fontSize: Math.round(clamp(boxH * 0.13, 16, 44)) } : undefined;
  const subStyle = big ? { fontSize: Math.round(clamp(boxH * 0.1, 14, 28)) } : undefined;
  const badgeSize = big ? Math.round(clamp(boxH * 0.42, 56, 150)) : undefined;

  return (
    <div
      className={`tile${active ? " is-active" : ""}${unavailable ? " is-unavailable" : ""}${
        interactive ? " is-interactive" : ""
      }${big ? " is-big" : ""}`}
      {...handlers}
    >
      <span
        className="tile__badge"
        style={{ ...badgeStyle, ...(badgeSize ? { width: badgeSize, height: badgeSize } : {}) }}
      >
        <Icon size={iconSize} />
      </span>
      <div className="tile__text">
        <div className="tile__title" style={titleStyle}>
          {title}
        </div>
        {subtitle && (
          <div className="tile__subtitle" style={subStyle}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
