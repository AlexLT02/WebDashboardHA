import { useEffect, useState } from "react";
import { greeting } from "../state/board";
import { formatTemperature } from "../state/display";
import { useEntity } from "../state/store";
import { ThermometerIcon } from "../controls/icons";

/** Raumtemperatur in der Kopfzeile. Fehlt das Entity, entfällt die Zeile. */
const ROOM_TEMP_ENTITY = "sensor.thermometer_alex_temperature";

/** Kopfzeile der Dashboard-Ansicht: Gruß + Datum + Raumtemperatur + große Uhr. */
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
  const temperature = formatTemperature(useEntity(ROOM_TEMP_ENTITY));

  return (
    <div className="dash-header">
      <div className="dash-header__left">
        <div className="dash-header__greet">{greeting(now)}</div>
        <div className="dash-header__date">{date}</div>
        {temperature && (
          <div className="dash-header__temp">
            <ThermometerIcon size={17} />
            <span>{temperature}</span>
          </div>
        )}
      </div>
      <div className="dash-header__clock">{time}</div>
    </div>
  );
}
