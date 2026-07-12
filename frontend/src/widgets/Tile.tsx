import type { ComponentType } from "react";
import "./Tile.css";

interface Props {
  icon: ComponentType<{ size?: number }>;
  title: string;
  subtitle?: string;
  active?: boolean;
  /** Optionale Akzentfarbe (z. B. echte Lampenfarbe) fürs aktive Badge. */
  accent?: string;
  unavailable?: boolean;
  /** Tipp aufs Icon-Badge → Schnellaktion (z. B. toggle). */
  onIconClick?: () => void;
  /** Tipp auf die Kachel → Detail/more-info. */
  onClick?: () => void;
}

/**
 * Kompakte HA-artige Kachel. Dichter als die alten Karten:
 * Icon-Badge + Name + Statuszeile in einer schmalen Zeile.
 */
export function Tile({
  icon: Icon,
  title,
  subtitle,
  active,
  accent,
  unavailable,
  onIconClick,
  onClick,
}: Props) {
  const badgeStyle =
    active && accent ? { background: accent, color: "#fff" } : undefined;

  return (
    <div
      className={`tile${active ? " is-active" : ""}${unavailable ? " is-unavailable" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <button
        type="button"
        className="tile__badge"
        style={badgeStyle}
        aria-label={onIconClick ? `${title} schalten` : title}
        disabled={!onIconClick || unavailable}
        onClick={(e) => {
          e.stopPropagation(); // nicht gleichzeitig die Kachel öffnen
          onIconClick?.();
        }}
      >
        <Icon size={22} />
      </button>
      <div className="tile__text">
        <div className="tile__title">{title}</div>
        {subtitle && <div className="tile__subtitle">{subtitle}</div>}
      </div>
    </div>
  );
}
