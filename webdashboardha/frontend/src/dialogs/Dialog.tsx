import { useEffect, type ReactNode } from "react";
import "./dialogs.css";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Etwas breiter (z. B. Geräte-Liste). */
  wide?: boolean;
}

/**
 * Zentrierter modaler Dialog mit Backdrop, Titelzeile und Schließen-Button.
 * Die Titelzeile bleibt stehen, nur der Inhalt scrollt — sonst wandert das ✕
 * bei langen Dialogen aus dem Bild.
 */
export function Dialog({ title, onClose, children, wide }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // "Esc" für ältere WebKit-Versionen (iOS 12 mit externer Tastatur).
      if (e.key === "Escape" || e.key === "Esc") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="dlg-backdrop" onClick={onClose}>
      <div
        className={`dlg${wide ? " dlg--wide" : ""}`}
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
        <div className="dlg__body ha-scroll">{children}</div>
      </div>
    </div>
  );
}
