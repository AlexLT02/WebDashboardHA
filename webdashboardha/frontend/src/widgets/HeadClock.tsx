import { Icon } from "../controls/icons";
import { useMinute } from "../state/clock";
import { dateLong, dayName, hhmm, num, parseNum, weatherIcon, weatherText } from "../state/format";
import { useEntity } from "../state/store";
import type { Board } from "../state/model";

function deg(v: number | null): string {
  return v === null ? "–" : `${num(v, 1)}°`;
}

/** Header (04 §5.4): clock 80/600, weekday + date, weather with today's range. */
export function HeadClock({ head }: { head: Board["start"]["head"] }) {
  const now = useMinute();
  const out = useEntity(head.outside_temp);
  const weather = useEntity(head.weather);
  const fc = useEntity(head.forecast);
  const t = parseNum(out?.state) ?? parseNum(weather?.attributes.temperature);
  const cond = weather?.state;
  const text = weatherText(cond);
  const hi = parseNum(fc?.attributes.temperature);
  const lo = parseNum(fc?.attributes.templow);
  return (
    <header className="head">
      <div className="clock">{hhmm(now)}</div>
      <div className="date">
        <div className="date__day">{dayName(now)}</div>
        <div className="date__main">{dateLong(now)}</div>
      </div>
      <div className="weather">
        <Icon name={weatherIcon(cond)} />
        <div className="weather__temp">{deg(t)}</div>
        <div className="weather__txt">
          <b>{text ? `außen, ${text}` : "außen"}</b>
          {hi !== null && lo !== null ? (
            <>
              <br />
              {`heute ${Math.round(lo)}° bis ${Math.round(hi)}°`}
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
