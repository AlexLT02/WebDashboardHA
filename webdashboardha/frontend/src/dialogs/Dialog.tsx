import type { ReactNode } from "react";
import "./dialogs.css";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Etwas breiter (z. B. Geräte-Liste). */
  wide?: boolean;
}

/** Zentrierter modaler Dialog mit Backdrop, Titelzeile und Schließen-Button. */
export function Dialog({ title, onClose, children, wide }: Props) {
  return (
    <div className="dlg-backdrop" onClick={onClose}>
      <div
        className={`dlg${wide ? " dlg--wide" : ""} ha-scroll`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="dlg__head">
          <div className="dlg__title">{title}</div>
          <button type="button" className="dlg__close" aria-label="Schließen" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
