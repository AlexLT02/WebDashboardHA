import { useState } from "react";
import { Dialog } from "../Dialog";
import { Press } from "../../controls/Press";
import { fire } from "../../state/commands";
import { FAN_LABELS, segmentCall, segmentChips, vacuumButtons, vacuumError, vacuumHead, type VacuumCfg } from "../../state/devices";
import { parseNum } from "../../state/format";
import { useBoard, useEntity } from "../../state/store";
import type { LageCfg } from "../../state/model";

const ACTIVE = { cleaning: 1, returning: 1 } as Record<string, number>;

/**
 * Sauger (04 §5.5): status + battery, Starten/Fortsetzen · Pause · Zur Station
 * (112 x 64, only the matching ones active), room chips (multi select) ->
 * "Auswahl saugen (n)" via dreame_vacuum.vacuum_clean_segment, suction power,
 * amber error line. No map (A7 cannot decode it live).
 */
export function VacuumPopup({ entityId }: { entityId?: string }) {
  const board = useBoard();
  const lage = board ? (board.start.lage.filter((b) => b.key === "sauger")[0] as (LageCfg & VacuumCfg) | undefined) : undefined;
  const cfg: VacuumCfg = lage && (!entityId || lage.vacuum === entityId) ? lage : { vacuum: entityId };
  const id = cfg.vacuum || entityId || "";
  const st = useEntity(id);
  const status = useEntity(cfg.status);
  const battery = useEntity(cfg.battery);
  const errSt = useEntity(cfg.error);
  const [sel, setSel] = useState<number[]>([]);
  const offline = !st || st.state === "unavailable";
  const bat = parseNum(battery ? battery.state : st?.attributes.battery);
  const head = vacuumHead(st, status ? status.state : undefined, bat);
  const btn = vacuumButtons(offline ? "unavailable" : st?.state);
  const err = vacuumError(errSt ? errSt.state : undefined);
  const chips = board ? segmentChips(cfg, board.zones) : [];
  const fanList = Array.isArray(st?.attributes.fan_speed_list) ? (st?.attributes.fan_speed_list as string[]) : [];
  const fan = st?.attributes.fan_speed;
  const call = (service: string, data?: Record<string, unknown>) => fire({ domain: "vacuum", service, entity_id: id, data });
  const toggleSeg = (sid: number) => setSel(sel.indexOf(sid) !== -1 ? sel.filter((x) => x !== sid) : sel.concat([sid]));
  const running = !!st && !!ACTIVE[st.state];
  const name = (lage && lage.name) || (st?.attributes.friendly_name as string) || "Sauger";

  return (
    <Dialog name={name} state={head} stateOn={running} badge={{ icon: "vacuum", on: running, offline }} idleMs={running ? 60000 : undefined}>
      {err ? <div className="popup__note amber">{`Fehler: ${err}`}</div> : null}
      <div className="qchips qchips--3" style={{ marginTop: 16 }}>
        <Press className={`qchip qchip--big${btn.start ? "" : " is-disabled"}`} disabled={!btn.start} label="Starten" onPress={() => call("start")}>
          {btn.resume ? "Fortsetzen" : "Starten"}
        </Press>
        <Press className={`qchip qchip--big${btn.pause ? "" : " is-disabled"}`} disabled={!btn.pause} label="Pause" onPress={() => call("pause")}>
          Pause
        </Press>
        <Press className={`qchip qchip--big${btn.dock ? "" : " is-disabled"}`} disabled={!btn.dock} label="Zur Station" onPress={() => call("return_to_base")}>
          Zur Station
        </Press>
      </div>
      {chips.length ? (
        <>
          <div className="psub">
            Räume<span>Mehrfachauswahl</span>
          </div>
          <div className="qchips qchips--3">
            {chips.map((c) => (
              <Press
                key={c.id}
                className={`qchip${sel.indexOf(c.id) !== -1 ? " is-on" : ""}${offline ? " is-disabled" : ""}`}
                disabled={offline}
                label={`Raum ${c.name}`}
                onPress={() => toggleSeg(c.id)}
              >
                {c.name}
              </Press>
            ))}
          </div>
          <Press
            className={`pbtn${sel.length && !offline ? " pbtn--cool" : " is-disabled"}`}
            disabled={!sel.length || offline}
            label="Auswahl saugen"
            onPress={() => {
              fire(segmentCall(id, sel));
              setSel([]);
            }}
          >
            {sel.length ? `Auswahl saugen (${sel.length})` : "Räume wählen, dann saugen"}
          </Press>
        </>
      ) : null}
      {fanList.length ? (
        <>
          <div className="psub">Saugstärke</div>
          <div className="qchips">
            {fanList.map((f) => (
              <Press
                key={f}
                className={`qchip${fan === f ? " is-sel" : ""}${offline ? " is-disabled" : ""}`}
                disabled={offline}
                label={`Saugstärke ${FAN_LABELS[f] || f}`}
                onPress={() => call("set_fan_speed", { fan_speed: f })}
              >
                {FAN_LABELS[f] || f}
              </Press>
            ))}
          </div>
        </>
      ) : null}
    </Dialog>
  );
}
