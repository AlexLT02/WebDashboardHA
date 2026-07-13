import { useEffect, useState } from "react";
import { useCellBox, clampNum } from "../state/useViewport";
import type { WidgetConfig } from "../state/dashboards";
import "./panels.css";

export function ClockCard({ config }: { config: WidgetConfig }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Schrift wächst mit der Kachelgröße — aber passend zur Breite/Zeichenzahl,
  // damit die Zeit nie aus der Card läuft.
  const { boxW, boxH } = useCellBox(config.w, config.h);
  const showSeconds = boxW >= 260; // Sekunden nur, wenn wirklich breit genug
  const showDate = boxH >= 118;

  const time = now.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    ...(showSeconds ? { second: "2-digit" } : {}),
  });
  // Breite pro Ziffer ~0,6·Schriftgröße → Schrift = Breite / (Zeichen·0,6).
  const avail = boxW - 24; // Padding
  const byWidth = avail / (time.length * 0.6);
  const timeFont = Math.round(clampNum(Math.min(byWidth, boxH * 0.55), 18, 240));
  const dateFont = Math.round(clampNum(timeFont * 0.28, 12, 44));
  const date = now.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="panel panel--center">
      <div className="clock__time" style={{ fontSize: timeFont }}>
        {time}
      </div>
      {showDate && (
        <div className="clock__date" style={{ fontSize: dateFont }}>
          {date}
        </div>
      )}
    </div>
  );
}
