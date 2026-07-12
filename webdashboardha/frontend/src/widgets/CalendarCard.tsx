import type { WidgetConfig } from "../state/dashboards";
import "./panels.css";

const DOW = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function CalendarCard({ config }: { config: WidgetConfig }) {
  const now = new Date();
  const big = config.w >= 2 && config.h >= 2;

  if (!big) {
    // Kompakt: großes Datum
    return (
      <div className="panel panel--center">
        <div className="cal__big">
          <div className="cal__big-day">{now.getDate()}</div>
          <div className="cal__big-sub">
            {now.toLocaleDateString("de-DE", { weekday: "short", month: "long" })}
          </div>
        </div>
      </div>
    );
  }

  // Groß: Mini-Monat mit heute markiert
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow = (first.getDay() + 6) % 7; // Montag = 0
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="panel">
      <div className="cal__title">
        {now.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
      </div>
      <div className="cal__grid">
        {DOW.map((d) => (
          <div className="cal__dow" key={d}>
            {d}
          </div>
        ))}
        {cells.map((d, i) => (
          <div
            key={i}
            className={
              d === null
                ? "cal__day cal__day--empty"
                : d === now.getDate()
                  ? "cal__day cal__day--today"
                  : "cal__day"
            }
          >
            {d ?? "."}
          </div>
        ))}
      </div>
    </div>
  );
}
