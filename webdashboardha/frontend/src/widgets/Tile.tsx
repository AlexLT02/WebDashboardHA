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

  return (
    <div
      className={`tile${active ? " is-active" : ""}${unavailable ? " is-unavailable" : ""}${
        interactive ? " is-interactive" : ""
      }${big ? " is-big" : ""}`}
      {...handlers}
    >
      <span className="tile__badge" style={badgeStyle}>
        <Icon size={big ? 30 : 22} />
      </span>
      <div className="tile__text">
        <div className="tile__title">{title}</div>
        {subtitle && <div className="tile__subtitle">{subtitle}</div>}
      </div>
    </div>
  );
}
