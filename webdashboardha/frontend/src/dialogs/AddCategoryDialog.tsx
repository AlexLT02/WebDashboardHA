import { useState } from "react";
import { ICONS } from "../controls/icons";
import { Dialog } from "./Dialog";

interface Props {
  onCreate: (name: string, icon: string) => void;
  onClose: () => void;
}

const ICON_CHOICES = [
  "light",
  "plug",
  "fan",
  "blinds",
  "speaker",
  "motion",
  "coffee",
  "heater",
  "tv",
  "garage",
  "fridge",
  "power",
];

export function AddCategoryDialog({ onCreate, onClose }: Props) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("light");
  const valid = name.trim().length > 0;

  return (
    <Dialog title="Kategorie hinzufügen" onClose={onClose}>
      <div className="dlg__label">Name</div>
      <input
        className="dlg__input"
        type="text"
        placeholder="z. B. Garten, Sicherheit…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <div className="dlg__gap" />

      <div className="dlg__label">Symbol</div>
      <div className="dlg__icons">
        {ICON_CHOICES.map((key) => {
          const Icon = ICONS[key] ?? ICONS.light;
          return (
            <button
              key={key}
              type="button"
              className={`dlg__icon-pick${icon === key ? " is-sel" : ""}`}
              aria-label={key}
              onClick={() => setIcon(key)}
            >
              <Icon size={20} />
            </button>
          );
        })}
      </div>
      <div className="dlg__gap" />

      <button
        type="button"
        className="dlg__primary"
        disabled={!valid}
        onClick={() => {
          if (!valid) return;
          onCreate(name.trim(), icon);
          onClose();
        }}
      >
        Kategorie erstellen
      </button>
    </Dialog>
  );
}
