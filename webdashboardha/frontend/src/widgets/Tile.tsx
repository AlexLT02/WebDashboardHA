import type { ComponentType } from "react";
import { useLongPress } from "../controls/useLongPress";
import { useCellBox, clampNum } from "../state/useViewport";
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
  /** Rastermaße — skalieren Icon/Schrift bei größeren Kacheln mit (nach Breite UND Höhe). */
  gridW?: number;
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
  gridW = 1,
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

  // Bei größeren Kacheln Icon/Schrift mitskalieren — nach BEIDEN Dimensionen,
  // damit der Titel in die (ggf. schmale) Breite passt und nicht überläuft.
  const { boxW, boxH } = useCellBox(gridW, gridH);
  const unit = Math.min(boxW, boxH);
  const iconSize = big ? Math.round(clampNum(unit * 0.3, 30, 96)) : 22;
  const titleStyle = big
    ? { fontSize: Math.round(clampNum(Math.min(boxW * 0.15, boxH * 0.13), 15, 28)) }
    : undefined;
  const subStyle = big
    ? { fontSize: Math.round(clampNum(Math.min(boxW * 0.11, boxH * 0.1), 13, 20)) }
    : undefined;
  const badgeSize = big ? Math.round(clampNum(unit * 0.4, 56, 120)) : undefined;

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
