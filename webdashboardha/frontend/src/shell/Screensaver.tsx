import { useEffect, useState } from "react";

/** Vollflächige Uhr als Bildschirmschoner; verschwindet bei Berührung. */
export function Screensaver({ onDismiss }: { onDismiss: () => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let id = 0;
    const tick = () => {
      setNow(new Date());
      id = window.setTimeout(tick, 60000 - (Date.now() % 60000) + 50);
    };
    id = window.setTimeout(tick, 60000 - (Date.now() % 60000) + 50);
    return () => window.clearTimeout(id);
  }, []);

  const time = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="saver" onMouseDown={onDismiss} onTouchStart={onDismiss}>
      <div className="saver__time">{time}</div>
      <div className="saver__date">{date}</div>
    </div>
  );
}
