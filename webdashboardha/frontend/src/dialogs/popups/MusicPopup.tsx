import { useEffect, useState } from "react";
import { Dialog } from "../Dialog";
import { DragBar } from "../../controls/DragBar";
import { Icon } from "../../controls/icons";
import { Press } from "../../controls/Press";
import { fire, toggleItem } from "../../state/commands";
import { scriptCall } from "../../state/devices";
import { parseNum, pct } from "../../state/format";
import { TIMEOUT_CLOUD_MS, TIMEOUT_LOCAL_MS, usePend } from "../../state/pending";
import { useBoard, useEntity, useStore } from "../../state/store";
import { isOnState } from "../../state/tileState";
import { useTileView } from "../../widgets/useTileView";
import { shownView } from "../../widgets/Tile";
import { footText } from "./common";
import type { Item } from "../../state/model";

/** Snapcast is local: a volume every 250 ms while dragging (max 4 calls/s). */
const ROOM_THROTTLE_MS = 250;
const MUTE_HOLD_MS = 4000;

/**
 * One volume row: name + percent, mute 48 x 48 (`volume_mute`, only
 * is_volume_muted), volume bar 44 (`volume_set`, never `muted` with it).
 * Echos (cloud) have no mute button and send only on release.
 */
function VolumeRow({ id, name, echo }: { id: string; name: string; echo?: boolean }) {
  const st = useEntity(id);
  const [local, setLocal] = useState<number | null>(null);
  const [muteWant, setMuteWant] = useState<{ v: boolean; at: number } | null>(null);
  const offline = !st || st.state === "unavailable";
  const reported = parseNum(st?.attributes.volume_level);
  const mutedReported = st?.attributes.is_volume_muted === true;
  useEffect(() => {
    if (!muteWant) return;
    if (mutedReported === muteWant.v) {
      setMuteWant(null);
      return;
    }
    const t = window.setTimeout(() => setMuteWant(null), Math.max(0, muteWant.at + MUTE_HOLD_MS - Date.now()));
    return () => window.clearTimeout(t);
  }, [muteWant, mutedReported]);
  const muted = muteWant ? muteWant.v : mutedReported;
  const shownPct = local !== null ? Math.round(local * 100) : reported !== null ? Math.round(reported * 100) : null;
  return (
    <div className={`vrow${echo ? " vrow--echo" : ""}${offline ? " is-offline" : ""}`} data-id={id}>
      <div className="vrow__name">{name}</div>
      <div className={`vrow__pct${muted && !offline ? " amber" : ""}`}>{offline ? "Offline" : muted ? `Stumm, ${pct(shownPct)}` : pct(shownPct)}</div>
      {!echo ? (
        <Press
          className={`vrow__mute${muted ? " is-muted" : ""}`}
          disabled={offline}
          label={`${name} ${muted ? "Ton an" : "stumm"}`}
          onPress={() => {
            setMuteWant({ v: !muted, at: Date.now() });
            fire({ domain: "media_player", service: "volume_mute", entity_id: id, data: { is_volume_muted: !muted } });
          }}
        >
          <Icon name={muted ? "mute" : "volume"} />
        </Press>
      ) : null}
      <DragBar
        mode="fill"
        className="bar--vol"
        value={reported}
        disabled={offline}
        throttleMs={echo ? 0 : ROOM_THROTTLE_MS}
        timeoutMs={echo ? TIMEOUT_CLOUD_MS : TIMEOUT_LOCAL_MS}
        label={`${name} Lautstärke`}
        confirm={(t, r) => r !== null && Math.abs(t - r) <= 0.02}
        onLocal={setLocal}
        onCommit={(v) => fire({ domain: "media_player", service: "volume_set", entity_id: id, data: { volume_level: Math.round(v * 100) / 100 } })}
      />
    </div>
  );
}

/**
 * Musik (04 §5.5): Multiroom on/off, source as text, one 56 px row per room,
 * "Sony XP700 wecken", Echos folded. Opens from the music tiles and the
 * "Musik" favourite; the head badge does what the tile badge does.
 */
export function MusicPopup({ item, name }: { item: Item; name?: string }) {
  const board = useBoard();
  const view = useTileView(item);
  const pend = usePend(item.id);
  const music = board ? board.music : {};
  const mrItem = music.multiroom && board ? board.items[music.multiroom] : undefined;
  const mrView = useTileView(mrItem);
  const mrPend = usePend(mrItem ? mrItem.id : "");
  const mrOn = useStore((s) => (music.multiroom ? isOnState(s.states[music.multiroom]) : false));
  const source = useStore((s) => {
    for (const r of music.rooms || []) {
      const src = s.states[r.id]?.attributes.source;
      if (typeof src === "string" && src) return src;
    }
    return "";
  });
  const [echos, setEchos] = useState(false);
  const [woke, setWoke] = useState(false);
  useEffect(() => {
    if (!woke) return;
    const t = window.setTimeout(() => setWoke(false), 4000);
    return () => window.clearTimeout(t);
  }, [woke]);
  if (!view) return null;
  const shown = shownView(view, pend ? pend.on : null, pend ? pend.phase : null);
  const mrShown = mrView ? shownView(mrView, mrPend ? mrPend.on : null, mrPend ? mrPend.phase : null) : null;
  const echoList = music.echos || [];
  return (
    <Dialog
      name={name || item.name}
      state={shown.status}
      stateOn={shown.on}
      badge={{ icon: item.icon || "music", on: shown.on, offline: view.offline, onToggle: view.badge && !view.offline ? () => toggleItem(item, view) : undefined }}
      foot={footText(board, item, undefined)}
      idleMs={mrOn ? 60000 : undefined}
    >
      {mrItem && mrView && mrShown ? (
        <Press
          className={`bigsw${mrShown.on ? " is-on" : ""}${mrView.offline ? " is-disabled" : ""}`}
          disabled={mrView.offline}
          label="Multiroom schalten"
          onPress={() => toggleItem(mrItem, mrView)}
        >
          {mrView.offline ? "Multiroom offline" : mrPend && mrPend.phase === "wait" ? mrShown.status : mrShown.on ? "Multiroom an" : "Multiroom aus"}
        </Press>
      ) : null}
      <div className="psub">
        Räume<span>{source ? `Quelle: ${source}` : ""}</span>
      </div>
      <div className="vrows">
        {(music.rooms || []).map((r) => (
          <VolumeRow key={r.id} id={r.id} name={r.name} />
        ))}
      </div>
      <div className="pbtns">
        {music.wake_script ? (
          <Press className="pbtn" label="Sony XP700 wecken" onPress={() => {
            setWoke(true);
            fire(scriptCall(music.wake_script as string));
          }}>
            {woke ? "Wird geweckt …" : "Sony XP700 wecken"}
          </Press>
        ) : null}
        {echoList.length ? (
          <Press className={`pbtn${echos ? " pbtn--cool" : ""}`} label="Echos" onPress={() => setEchos(!echos)}>
            {`Echos (${echoList.length})`}
            <Icon name="chev" className={echos ? "chev chev--up" : "chev chev--down"} />
          </Press>
        ) : null}
      </div>
      {echos ? (
        <div className="vrows">
          {echoList.map((e) => (
            <VolumeRow key={e.id} id={e.id} name={e.name} echo />
          ))}
        </div>
      ) : null}
    </Dialog>
  );
}
