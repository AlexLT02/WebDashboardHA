import { useEffect, useState } from "react";
import { greeting } from "../state/board";

/** Kopfzeile der Dashboard-Ansicht: Tageszeit-Gruß + Datum + große Uhr. */
export function Header() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Auf die Minutengrenze ausrichten, damit die Anzeige (HH:MM) sofort umspringt
    // und nicht bis zu einem Intervall nachhinkt.
    let id = 0;
    const tick = () => {
      setNow(new Date());
      id = window.setTimeout(tick, 60000 - (Date.now() % 60000) + 50);
    };
    id = window.setTimeout(tick, 60000 - (Date.now() % 60000) + 50);
    return () => window.clearTimeout(id);
  }, []);

  const time = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "long" });

  return (
    <div className="dash-header">
      <div className="dash-header__left">
        <div className="dash-header__greet">{greeting(now)}</div>
        <div className="dash-header__date">{date}</div>
      </div>
      <div className="dash-header__clock">{time}</div>
    </div>
  );
}
