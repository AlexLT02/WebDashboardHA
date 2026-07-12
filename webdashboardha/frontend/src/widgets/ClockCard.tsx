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

  // Schrift wächst mit der Kachelgröße mit.
  const { boxW, boxH } = useCellBox(config.w, config.h);
  const timeFont = Math.round(clampNum(Math.min(boxW * 0.26, boxH * 0.52), 24, 220));
  const dateFont = Math.round(clampNum(timeFont * 0.3, 12, 46));
  const showSeconds = boxW >= 170;
  const showDate = boxH >= 118;

  const time = now.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    ...(showSeconds ? { second: "2-digit" } : {}),
  });
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
