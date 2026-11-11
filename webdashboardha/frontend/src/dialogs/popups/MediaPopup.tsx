import { useRef } from "react";
import { Dialog } from "../Dialog";
import { Icon } from "../../controls/icons";
import { Press } from "../../controls/Press";
import { useCollector } from "../../controls/useCollector";
import { useTap } from "../../controls/useTap";
import { fire, toggleItem } from "../../state/commands";
import { irVolumeCall, isRunning, mediaTitle, scriptCall, soundText, transportOf, type SoundCfg } from "../../state/devices";
import { usePend } from "../../state/pending";
import { useBoard, useEntity } from "../../state/store";
import { useTileView } from "../../widgets/useTileView";
import { shownView } from "../../widgets/Tile";
import { footText, itemFor } from "./common";
import type { Item } from "../../state/model";

/** Zurück · Play/Pause · Weiter (>= 96 x 56) on one player, only what it supports. */
function TransportRow({ entityId }: { entityId: string }) {
  const st = useEntity(entityId);
  if (!isRunning(st)) return null;
  const t = transportOf(st);
  const call = (service: string) => fire({ domain: "media_player", service, entity_id: entityId });
  return (
    <div className="tbtns">
      <Press className={`tbtn${t.prev ? "" : " is-disabled"}`} disabled={!t.prev} label="Zurück" onPress={() => call("media_previous_track")}>
        <Icon name="prev" />
      </Press>
      <Press className={`tbtn${t.playPause ? "" : " is-disabled"}`} disabled={!t.playPause} label="Play oder Pause" onPress={() => call("media_play_pause")}>
        <Icon name="playpause" />
      </Press>
      <Press className={`tbtn${t.next ? "" : " is-disabled"}`} disabled={!t.next} label="Weiter" onPress={() => call("media_next_track")}>
        <Icon name="next" />
      </Press>
    </div>
  );
}

/** Big Ein/Aus switch that runs the item's own toggle (optimistic). */
function BigToggle({ item, onText, offText }: { item: Item; onText: string; offText: string }) {
  const view = useTileView(item);
  const pend = usePend(item.id);
  if (!view) return null;
  const shown = shownView(view, pend ? pend.on : null, pend ? pend.phase : null);
  const disabled = view.offline || !view.badge;
  return (
    <Press
      className={`bigsw${shown.on ? " is-on" : ""}${disabled ? " is-disabled" : ""}`}
      disabled={disabled}
      label={`${item.name} schalten`}
      onPress={() => toggleItem(item, view)}
    >
      {view.offline ? "Offline" : pend && pend.phase === "wait" ? shown.status : shown.on ? onText : offText}
    </Press>
  );
}

/** Icon toggle with the name below (TV popup "Licht"). */
function LightToggle({ id }: { id: string }) {
  const board = useBoard();
  const st = useEntity(id);
  const item = itemFor(board, id, st);
  const view = useTileView(item);
  const pend = usePend(id);
  const viewRef = useRef(view);
  viewRef.current = view;
  const ref = useTap({
    pressSelector: ".badge",
    onTap: () => {
      const v = viewRef.current;
      if (v && v.badge && !v.offline) toggleItem(item, v);
    },
  });
  if (!view) return null;
  const shown = shownView(view, pend ? pend.on : null, pend ? pend.phase : null);
  const cls = ["ltog"];
  if (view.offline) cls.push("is-offline");
  else if (shown.on) cls.push("is-on");
  return (
    <div ref={ref} className={cls.join(" ")} data-id={id} role="button" aria-label={`${item.name} schalten`}>
      <div className="badge" style={pend && pend.phase === "wait" ? { opacity: 0.55 } : undefined}>
        <Icon name={item.icon} />
      </div>
      <div className="ltog__name">{item.name}</div>
    </div>
  );
}

/**
 * Fernsehen (04 §5.5, D9): Ein/Aus over the Fire TV Max, transport while
 * something runs, sound system mode as text; Leiser/Lauter only in mode `tv`
 * (taps collected into one IR script run), "Ton neu abgleichen", TV lights.
 * No raw IR switches: script.soundanlage_anwenden owns the mode.
 */
export function TvPopup({ item, name }: { item: Item; name?: string }) {
  const board = useBoard();
  const view = useTileView(item);
  const pend = usePend(item.id);
  const primary = useEntity(item.primary);
  const sound = (item.sound || {}) as SoundCfg;
  const mode = useEntity(sound.mode);
  const vol = useCollector<number>(
    (acc, v) => (acc || 0) + v,
    (net) => {
      const call = irVolumeCall(sound, net);
      if (call) fire(call);
    },
  );
  if (!view) return null;
  const shown = shownView(view, pend ? pend.on : null, pend ? pend.phase : null);
  const modeState = mode ? mode.state : undefined;
  const tvMode = modeState === "tv";
  const net = vol.value || 0;
  return (
    <Dialog
      name={name || item.name}
      state={shown.status}
      stateOn={shown.on}
      badge={{ icon: item.icon || "tv", on: shown.on, offline: view.offline, onToggle: view.offline ? undefined : () => toggleItem(item, view) }}
      foot={footText(board, item, primary)}
    >
      <BigToggle item={item} onText="Fernsehen an" offText="Fernsehen aus" />
      {item.primary ? <TransportRow entityId={item.primary} /> : null}
      <div className="psub">
        Ton<span>{`Soundanlage: ${soundText(modeState)}`}</span>
      </div>
      <div className={tvMode ? "tbtns" : "pbtns"} style={tvMode ? undefined : { gridTemplateColumns: "1fr" }}>
        {tvMode ? (
          <>
            <Press className="tbtn" label="Leiser" onPress={() => vol.push(-1)}>
              <Icon name="minus" />
              <span>{net < 0 ? `Leiser ${-net}` : "Leiser"}</span>
            </Press>
            <Press className="tbtn" label="Lauter" onPress={() => vol.push(1)}>
              <Icon name="plus" />
              <span>{net > 0 ? `Lauter ${net}` : "Lauter"}</span>
            </Press>
          </>
        ) : null}
        {sound.apply_script ? (
          <Press className={tvMode ? "tbtn" : "pbtn"} label="Ton neu abgleichen" onPress={() => fire(scriptCall(sound.apply_script as string))}>
            {tvMode ? "Neu abgleichen" : "Ton neu abgleichen"}
          </Press>
        ) : null}
      </div>
      {item.lights && item.lights.length ? (
        <>
          <div className="psub">Licht</div>
          <div className="ltogs">
            {item.lights.map((id) => (
              <LightToggle key={id} id={id} />
            ))}
          </div>
        </>
      ) : null}
    </Dialog>
  );
}

/** Medien einfach (04 §5.5): Ein/Aus + transport, title as note. */
export function MediaPopup({ item, name }: { item: Item; name?: string }) {
  const board = useBoard();
  const st = useEntity(item.id);
  const view = useTileView(item);
  const pend = usePend(item.id);
  if (!view) return null;
  const shown = shownView(view, pend ? pend.on : null, pend ? pend.phase : null);
  const title = mediaTitle(st);
  return (
    <Dialog
      name={name || item.name}
      state={shown.status}
      stateOn={shown.on}
      badge={{ icon: item.icon || "tv", on: shown.on, offline: view.offline, onToggle: view.offline ? undefined : () => toggleItem(item, view) }}
      foot={footText(board, item, st)}
    >
      <BigToggle item={item} onText="An" offText="Aus" />
      <TransportRow entityId={item.id} />
      {title && isRunning(st) ? <div className="popup__note">{`Läuft: ${title}`}</div> : null}
    </Dialog>
  );
}
