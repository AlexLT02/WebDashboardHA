import { useEffect, useState } from "react";
import { Dialog } from "../Dialog";
import { Icon } from "../../controls/icons";
import { Press } from "../../controls/Press";
import { useCollector } from "../../controls/useCollector";
import { fire, hvacCall, toggleItem } from "../../state/commands";
import { stepTarget } from "../../state/collect";
import { acOn, boostOf, climateLimits, heatingRoom, hvacAllowed, isManualSoll, PLAN_HINT } from "../../state/climate";
import { hhmm, num, parseNum, pct } from "../../state/format";
import { usePend } from "../../state/pending";
import { useBoard, useEntity } from "../../state/store";
import { useTileView } from "../../widgets/useTileView";
import { shownView } from "../../widgets/Tile";
import { footText } from "./common";
import type { Item } from "../../state/model";

/** How long a sent set point stays "ours" while the cloud catches up. */
const LOCAL_HOLD_MS = 10000;

/**
 * Soll stepper: taps are collected and ONE climate.set_temperature goes out
 * 800 ms after the last tap (04 §5.5). The dialled value shows at once and
 * stays until HA reports it (or 10 s pass).
 */
function useSetPoint(entityId: string, reported: number | null) {
  const [sent, setSent] = useState<{ v: number; at: number } | null>(null);
  const col = useCollector<number>(
    (_acc, v) => v,
    (v) => {
      setSent({ v, at: Date.now() });
      fire({ domain: "climate", service: "set_temperature", entity_id: entityId, data: { temperature: v } });
    },
  );
  useEffect(() => {
    if (!sent) return;
    if (reported !== null && Math.abs(reported - sent.v) < 0.05) {
      setSent(null);
      return;
    }
    const t = window.setTimeout(() => setSent(null), Math.max(0, sent.at + LOCAL_HOLD_MS - Date.now()));
    return () => window.clearTimeout(t);
  }, [sent, reported]);
  const local = col.value !== undefined ? col.value : sent ? sent.v : null;
  return { local, shown: local !== null ? local : reported, push: col.push };
}

function Stepper({ value, digits, local, disabled, onStep }: { value: number | null; digits: number; local: boolean; disabled: boolean; onStep: (dir: 1 | -1) => void }) {
  return (
    <div className="stepper">
      <Press className={`stepper__btn stepper__btn--l${disabled ? " is-disabled" : ""}`} disabled={disabled} label="Kälter" onPress={() => onStep(-1)}>
        <Icon name="minus" />
      </Press>
      <div className={`stepper__v${local ? " is-local" : ""}`}>
        <small>Soll</small>
        {value !== null ? `${num(value, digits)}°` : "–"}
      </div>
      <Press className={`stepper__btn stepper__btn--r${disabled ? " is-disabled" : ""}`} disabled={disabled} label="Wärmer" onPress={() => onStep(1)}>
        <Icon name="plus" />
      </Press>
    </div>
  );
}

/**
 * Klima (climate_tuya, 04 §5.5): Ist big + humidity, Soll ± 0,5 (collected),
 * reason line, Boost 30 min, heating mode. NO on/off and NO hvac mode (D8).
 */
export function HeatingPopup({ item, name }: { item: Item; name?: string }) {
  const board = useBoard();
  const st = useEntity(item.id);
  const room = heatingRoom(item, board?.heating);
  const ist = useEntity(room ? room.ist : undefined);
  const hum = useEntity(room ? room.hum : undefined);
  const reason = useEntity(room ? room.reason : undefined);
  const planned = useEntity(room ? room.soll_helper : undefined);
  const timer = useEntity(room ? room.boost_timer : undefined);
  const mode = useEntity(board?.heating.mode);
  const view = useTileView(item);
  const offline = !st || st.state === "unavailable";
  const reported = parseNum(st?.attributes.temperature);
  const lim = climateLimits(st, true);
  const sp = useSetPoint(item.id, reported);
  const boost = boostOf(timer);
  if (!view) return null;
  const istV = parseNum(ist ? ist.state : st?.attributes.current_temperature);
  const humV = parseNum(hum?.state);
  const manual = isManualSoll(reported, parseNum(planned?.state), sp.local);
  const reasonText = reason && reason.state !== "unknown" && reason.state !== "unavailable" ? reason.state : "";
  const options = board?.heating.mode_options_shown || [];
  const modeState = mode ? mode.state : "";

  return (
    <Dialog
      name={name || item.name}
      state={view.status}
      stateOn={boost.active}
      badge={{ icon: item.icon || "heater", on: boost.active, offline }}
      foot={footText(board, item, st)}
    >
      <div className="pbig">
        <span className="pbig__num">{istV !== null ? `${num(istV, 1)}°` : "–"}</span>
        <span className="pbig__k">{humV !== null ? `Raum, ${pct(humV)} Feuchte` : "Raum"}</span>
      </div>
      <Stepper
        value={sp.shown}
        digits={1}
        local={sp.local !== null}
        disabled={offline}
        onStep={(dir) => sp.push(stepTarget(sp.shown !== null ? sp.shown : 21, dir, lim.step, lim.min, lim.max))}
      />
      <div className="popup__note" style={{ marginTop: 8 }}>
        {[reasonText, manual ? PLAN_HINT : ""].filter((s) => s).join(". ") || "Solltemperatur aus dem Heizplan"}
      </div>
      {room && room.boost_timer ? (
        <Press
          className={`pbtn${boost.active ? " is-on" : ""}${offline ? " is-disabled" : ""}`}
          disabled={offline}
          label="Boost"
          onPress={() =>
            fire({ domain: "timer", service: boost.active ? "cancel" : "start", entity_id: room.boost_timer as string })
          }
        >
          {boost.active ? `Boost bis ${boost.until !== null ? hhmm(boost.until) : "…"} · Beenden` : "Boost 30 min"}
        </Press>
      ) : null}
      {board?.heating.mode && options.length ? (
        <>
          <div className="psub">
            Heizmodus<span>gilt für Wohnbereich und Bad</span>
          </div>
          <div className="qchips">
            {options.map((o) => (
              <Press
                key={o}
                className={`qchip${modeState === o ? " is-sel" : ""}`}
                label={`Heizmodus ${o}`}
                onPress={() =>
                  fire({ domain: "input_select", service: "select_option", entity_id: board.heating.mode as string, data: { option: o } })
                }
              >
                {o}
              </Press>
            ))}
          </div>
        </>
      ) : null}
    </Dialog>
  );
}

/**
 * Klima einfach (`climate`, e.g. the air conditioner): Aus | Kühlen and Soll ± 1.
 * The mode switch exists only for HVAC_ALLOWLIST entities (PL decision B2).
 */
export function SimpleClimatePopup({ item, name }: { item: Item; name?: string }) {
  const board = useBoard();
  const st = useEntity(item.id);
  const view = useTileView(item);
  const pend = usePend(item.id);
  const offline = !st || st.state === "unavailable";
  const reported = parseNum(st?.attributes.temperature);
  const lim = climateLimits(st, false);
  const sp = useSetPoint(item.id, reported);
  if (!view) return null;
  const shown = shownView(view, pend ? pend.on : null, pend ? pend.phase : null);
  const allowed = hvacAllowed(item.id);
  const on = acOn(st);
  const cur = parseNum(st?.attributes.current_temperature);
  const setMode = (m: "cool" | "off") => {
    const call = hvacCall(item.id, m);
    if (call) fire(call);
  };
  return (
    <Dialog
      name={name || item.name}
      state={shown.status}
      stateOn={shown.on}
      badge={{ icon: item.icon || "air", on: shown.on, offline, onToggle: allowed && !offline ? () => toggleItem(item, view) : undefined }}
      foot={footText(board, item, st)}
    >
      <div className="pbig">
        <span className="pbig__num">{cur !== null ? `${num(cur, cur % 1 ? 1 : 0)}°` : "–"}</span>
        <span className="pbig__k">Raum</span>
      </div>
      {allowed ? (
        <div className="seg">
          <Press className={!on ? "is-sel" : ""} disabled={offline} onPress={() => setMode("off")}>
            Aus
          </Press>
          <Press className={on ? "is-sel" : ""} disabled={offline} onPress={() => setMode("cool")}>
            Kühlen
          </Press>
        </div>
      ) : null}
      <Stepper
        value={sp.shown}
        digits={0}
        local={sp.local !== null}
        disabled={offline}
        onStep={(dir) => sp.push(stepTarget(sp.shown !== null ? sp.shown : 21, dir, lim.step, lim.min, lim.max))}
      />
    </Dialog>
  );
}
