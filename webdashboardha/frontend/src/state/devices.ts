/**
 * Pure helpers of the P4 popups (04 §5.5): media transport, sound system,
 * vacuum, appliances. No React, tested in devices.test.ts.
 */
import { duration, hhmm, parseNum } from "./format";
import { APPLIANCE_ABORTED, APPLIANCE_DONE, APPLIANCE_RUNNING } from "./tileState";
import type { ServiceCall } from "./api";
import type { EntityState, StateGetter, Zone } from "./model";

// ---- media ------------------------------------------------------------------------

const SF_PAUSE = 1;
const SF_PREV = 16;
const SF_NEXT = 32;
const SF_PLAY = 16384;

export interface Transport {
  playPause: boolean;
  prev: boolean;
  next: boolean;
}

/** Transport buttons a player supports (supported_features bits). */
export function transportOf(st: EntityState | undefined): Transport {
  const sf = st ? parseNum(st.attributes.supported_features) || 0 : 0;
  return { playPause: (sf & (SF_PAUSE | SF_PLAY)) !== 0, prev: (sf & SF_PREV) !== 0, next: (sf & SF_NEXT) !== 0 };
}

/** "Läuft etwas": playing, paused or buffering (an idle home screen is not). */
export function isRunning(st: EntityState | undefined): boolean {
  return !!st && (st.state === "playing" || st.state === "paused" || st.state === "buffering");
}

/** Title or app of a running player, "" if none. */
export function mediaTitle(st: EntityState | undefined): string {
  if (!st) return "";
  const t = st.attributes.media_title || st.attributes.app_name;
  return typeof t === "string" ? t : "";
}

// ---- sound system (D9) ------------------------------------------------------------

export interface SoundCfg {
  mode?: string;
  apply_script?: string;
  ir_script?: string;
  vol_up?: string;
  vol_down?: string;
}

const SOUND_TEXT: Record<string, string> = { tv: "TV", multiroom: "Multiroom", aus: "aus" };

export function soundText(mode: string | undefined): string {
  if (!mode || mode === "unavailable" || mode === "unknown") return "unbekannt";
  return SOUND_TEXT[mode] || mode;
}

/**
 * One IR script run for the collected Lauter/Leiser taps (net count). The
 * script toggles the Aqara scene switch `anzahl` times (`taste` = that switch).
 * Started via script.turn_on so the HTTP call does not wait for the IR presses.
 */
export function irVolumeCall(sound: SoundCfg, net: number): ServiceCall | null {
  if (!net || !sound.ir_script) return null;
  const taste = net > 0 ? sound.vol_up : sound.vol_down;
  if (!taste) return null;
  return {
    domain: "script",
    service: "turn_on",
    entity_id: sound.ir_script,
    data: { variables: { taste, anzahl: Math.abs(net) } },
  };
}

export function scriptCall(script: string): ServiceCall {
  return { domain: "script", service: "turn_on", entity_id: script };
}

// ---- vacuum -------------------------------------------------------------------------

export interface VacuumCfg {
  vacuum?: string;
  battery?: string;
  error?: string;
  room?: string;
  status?: string;
  segments?: Record<string, string>;
}

const VACUUM_HEAD: Record<string, string> = {
  cleaning: "Saugt",
  returning: "Fährt zurück",
  paused: "Pausiert",
  idle: "Bereit",
  error: "Fehler",
};

/** Popup head: "Bereit in der Station, Akku 100 %". */
export function vacuumHead(st: EntityState | undefined, status: string | undefined, battery: number | null): string {
  if (!st || st.state === "unavailable") return "Offline";
  let text: string;
  if (st.state === "docked" || st.state === "charging") {
    text = status === "charging" || st.state === "charging" ? "Lädt in der Station" : "Bereit in der Station";
  } else text = VACUUM_HEAD[st.state] || st.state;
  return battery !== null ? `${text}, Akku ${Math.round(battery)} %` : text;
}

export interface VacuumButtons {
  start: boolean;
  /** "Fortsetzen" instead of "Starten". */
  resume: boolean;
  pause: boolean;
  dock: boolean;
}

/** Only the buttons that make sense right now are active (02 §4). */
export function vacuumButtons(state: string | undefined): VacuumButtons {
  switch (state) {
    case "cleaning":
      return { start: false, resume: false, pause: true, dock: true };
    case "paused":
      return { start: true, resume: true, pause: false, dock: true };
    case "returning":
      return { start: true, resume: false, pause: true, dock: false };
    case "docked":
    case "charging":
      return { start: true, resume: false, pause: false, dock: false };
    case "idle":
    case "error":
      return { start: true, resume: false, pause: false, dock: true };
    default:
      return { start: false, resume: false, pause: false, dock: false };
  }
}

export const FAN_LABELS: Record<string, string> = {
  silent: "Leise",
  standard: "Standard",
  strong: "Stark",
  turbo: "Turbo",
};

export interface SegmentChip {
  id: number;
  name: string;
}

/** Room chips in rail order (zones carry their Dreame segment), the rest after. */
export function segmentChips(cfg: VacuumCfg, zones: Zone[]): SegmentChip[] {
  const map = cfg.segments || {};
  const out: SegmentChip[] = [];
  for (const z of zones) {
    const key = z.vacuum_segment !== undefined ? String(z.vacuum_segment) : "";
    if (key && map[key]) out.push({ id: Number(key), name: map[key] });
  }
  for (const key in map) {
    if (!out.some((c) => c.id === Number(key))) out.push({ id: Number(key), name: map[key] });
  }
  return out;
}

export function segmentCall(vacuum: string, ids: number[]): ServiceCall {
  return { domain: "dreame_vacuum", service: "vacuum_clean_segment", entity_id: vacuum, data: { segments: ids.slice() } };
}

/** Error text of sensor.dreame_error, "" when there is none. */
export function vacuumError(raw: string | undefined): string {
  if (!raw || raw === "no_error" || raw === "unknown" || raw === "unavailable") return "";
  return raw.replace(/_/g, " ");
}

// ---- appliances (WashData) ----------------------------------------------------------

export interface ApplianceRefs {
  state?: string;
  remaining?: string;
  progress?: string;
  program?: string;
  phase?: string;
  power?: string;
  unload_button?: string;
}

const APPLIANCE_TEXT: Record<string, string> = {
  off: "Aus",
  idle: "Bereit",
  starting: "Startet",
  running: "Läuft",
  paused: "Pausiert",
  user_paused: "Pausiert",
  ending: "Endet gleich",
  finished: "Fertig",
  clean: "Fertig",
  anti_wrinkle: "Knitterschutz",
  delay_wait: "Startet verzögert",
  interrupted: "Abgebrochen",
  force_stopped: "Abgebrochen",
  unknown: "Zustand unbekannt",
};

function known(raw: string | undefined): string {
  return raw && raw !== "unknown" && raw !== "unavailable" ? raw : "";
}

export interface ApplianceView {
  offline: boolean;
  running: boolean;
  done: boolean;
  /** Big value: "noch 42" (+ small "min") or the state ("Fertig"). */
  big: string;
  small: string;
  /** Right of the big value: "fertig ca. 19:20" / "seit 18:42". */
  side: string;
  /** Zustand row: WashData phase while running ("Spülen"), else the state text. */
  phase: string;
  program: string;
  progress: number | null;
  power: number | null;
  /** "Ausgeräumt" button entity, only when it is usable right now. */
  unload: string | null;
}

export function applianceView(refs: ApplianceRefs, get: StateGetter, now: number): ApplianceView {
  const st = refs.state ? get(refs.state) : undefined;
  const s = st ? st.state : "unavailable";
  const v: ApplianceView = {
    offline: s === "unavailable",
    running: APPLIANCE_RUNNING.indexOf(s) !== -1,
    done: APPLIANCE_DONE.indexOf(s) !== -1,
    big: APPLIANCE_TEXT[s] || (s === "unavailable" ? "Offline" : s),
    small: "",
    side: "",
    phase: APPLIANCE_TEXT[s] || s,
    program: known(refs.program ? get(refs.program)?.state : undefined),
    progress: parseNum(refs.progress ? get(refs.progress)?.state : undefined),
    power: parseNum(refs.power ? get(refs.power)?.state : undefined),
    unload: null,
  };
  const lc = st && typeof st.lc_ts === "number" ? st.lc_ts : null;
  if (v.running) {
    const rem = parseNum(refs.remaining ? get(refs.remaining)?.state : undefined);
    const phase = known(refs.phase ? get(refs.phase)?.state : undefined);
    if (phase) v.phase = phase;
    const paused = s === "paused" || s === "user_paused";
    if (!paused && rem !== null && rem > 0) {
      v.big = rem < 60 ? `noch ${Math.round(rem)}` : `noch ${duration(rem)}`;
      v.small = rem < 60 ? "min" : "";
      v.side = `fertig ca. ${hhmm(now + rem * 60000)}`;
    }
  } else if ((v.done || APPLIANCE_ABORTED.indexOf(s) !== -1) && lc !== null) {
    v.side = `seit ${hhmm(lc)}`;
  }
  if (v.done && refs.unload_button) {
    const b = get(refs.unload_button);
    if (b && b.state !== "unavailable") v.unload = refs.unload_button;
  }
  if (v.offline) v.progress = null;
  return v;
}
