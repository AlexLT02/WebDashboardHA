import "./Toggle.css";

interface Props {
  on: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}

/** Ein/Aus-Schalter (Touch-tauglich, ≥44px). */
export function Toggle({ on, onToggle, disabled, ...aria }: Props) {
  return (
    <button
      type="button"
      className={`toggle${on ? " is-on" : ""}`}
      role="switch"
      aria-checked={on}
      aria-label={aria["aria-label"]}
      disabled={disabled}
      onClick={() => onToggle(!on)}
    >
      <span className="toggle__knob" />
    </button>
  );
}
