import { useRef, useState } from "react";
import { Icon } from "../controls/icons";
import { HOLD_ALL_OFF_MS, useHold } from "../controls/useHold";
import { runOff } from "../state/commands";
import type { KgAllesAus } from "../state/model";

/**
 * "Alles aus" 184 x 72 (D3, 02 §3): hold 0.6 s. The fill runs from the left
 * after 150 ms (CSS on `is-holding`, transform only), the action fires at
 * 600 ms without releasing, a short tap teaches the gesture for 2 s.
 */
export function HoldButton({ kg }: { kg: KgAllesAus }) {
  const [hint, setHint] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const ref = useHold(
    HOLD_ALL_OFF_MS,
    () => {
      setHint(false);
      runOff({ scope: "alles_aus" });
    },
    () => {
      setHint(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setHint(false), 2000);
    },
  );
  return (
    <div ref={ref} className={`tile tile--hold${hint ? " is-hint" : ""}`} data-id="kg.alles_aus" role="button" aria-label={`${kg.name}, halten`}>
      <div className="hold-fill" />
      <div className="badge">
        <Icon name="power" />
      </div>
      <div className="tile__t">
        <div className="tile__name">{kg.name}</div>
        <div className="tile__sub">
          {hint ? (
            "Zum Ausschalten halten"
          ) : (
            <>
              <span className="hold-idle">halten</span>
              <span className="hold-on">weiter halten</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
