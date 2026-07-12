import { useEffect, useState } from "react";
import type { WidgetConfig } from "../state/dashboards";
import "./panels.css";

export function ClockCard({ config }: { config: WidgetConfig }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const big = config.w >= 2 || config.h >= 2;
  const time = now.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    ...(big ? { second: "2-digit" } : {}),
  });
  const date = now.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="panel panel--center">
      <div className="clock__time">{time}</div>
      {big && <div className="clock__date">{date}</div>}
    </div>
  );
}
