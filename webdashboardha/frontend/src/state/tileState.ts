/**
 * Pure tile logic: item kind + HA states -> what the tile shows (04 §5.3).
 * No React, no DOM: unit tested in tileState.test.ts.
 */
import { briPct, hhmm, parseNum, pct, temp, watts } from "./format";
import { coverStatus } from "./cover";
import type { EntityState, Heating, Item, MusicCfg, StateGetter } from "./model";

export interface TileCtx {
  get: StateGetter;
  now: number;
  heating?: Heating;
  music?: MusicCfg;
}

export interface TileView {
  /** Warm "on" look. */
  on: boolean;
  /** Icon sits in a switchable badge (icon zone switches). */
  badge: boolean;
  /** Empty socket look (unavailable). */
  offline: boolean;
  /** epoch ms since when the item is offline (null if unknown). */
  offlineSince: number | null;
  unknown: boolean;
  status: string;
  /** Lock icon before the status (critical socket, on). */
  lock: boolean;
  /** Switching off needs a 1 s hold (critical socket, on). */
  holdOff: boolean;
  /** Light colour pip on the badge (CSS colour) or null. */
  pip: string | null;
  /** x of n members on (groups). */
  members: { on: number; n: number } | null;
}

const OFF_MEDIA = { off: 1, standby: 1, unavailable: 1, unknown: 1 } as Record<string, number>;
const COLOR_MODES = { hs: 1, xy: 1, rgb: 1, rgbw: 1, rgbww: 1 } as Record<string, number>;
export const APPLIANCE_RUNNING = ["starting", "running", "ending", "anti_wrinkle", "delay_wait", "paused", "user_paused"];
export const APPLIANCE_DONE = ["finished", "clean"];
export const APPLIANCE_ABORTED = ["interrupted", "force_stopped"];

function base(): TileView {
  return {
    on: false, badge: false, offline: false, offlineSince: null, unknown: false,
    status: "Aus", lock: false, holdOff: false, pip: null, members: null,
  };
}

function offline(st: EntityState | undefined): TileView {
  const v = base();
  v.offline = true;
  v.offlineSince = st && typeof st.lc_ts === "number" ? st.lc_ts : null;
  v.status = v.offlineSince !== null ? `Offline seit ${hhmm(v.offlineSince)}` : "Offline";
  return v;
}

function unknownView(): TileView {
  const v = base();
  v.unknown = true;
  v.status = "Zustand unbekannt";
  return v;
}

export function isOnState(st: EntityState | undefined): boolean {
  return !!st && st.state === "on";
}

/** Is a media player "on" (screen or speaker active)? */
export function mediaOn(st: EntityState | undefined): boolean {
  return !!st && !OFF_MEDIA[st.state];
}

/** CSS colour of a light for the pip, only when it really shows a colour. */
export function lightPip(st: EntityState | undefined): string | null {
  if (!st || st.state !== "on") return null;
  const mode = st.attributes.color_mode;
  if (typeof mode !== "string" || !COLOR_MODES[mode]) return null;
  const rgb = st.attributes.rgb_color;
  if (Array.isArray(rgb) && rgb.length === 3) return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  const hs = st.attributes.hs_color;
  if (Array.isArray(hs) && hs.length === 2) {
    return `hsl(${Math.round(Number(hs[0]))},${Math.round(Math.max(40, Number(hs[1])))}%,58%)`;
  }
  return null;
}

/** "64 %" for a light that is on, "An" if HA reports no brightness (Tuya: 0). */
export function lightStatus(st: EntityState): string {
  const bri = parseNum(st.attributes.brightness);
  return bri && bri > 0 ? `${briPct(bri)} %` : "An";
}

function countOn(ids: string[], get: StateGetter, test: (s: EntityState | undefined) => boolean) {
  let on = 0;
  let avail = 0;
  for (const id of ids) {
    const s = get(id);
    if (s && s.state !== "unavailable") avail += 1;
    if (test(s)) on += 1;
  }
  return { on, n: ids.length, avail };
}

export function applianceStatus(st: EntityState, remaining: EntityState | undefined): { on: boolean; status: string } {
  const s = st.state;
  if (APPLIANCE_RUNNING.indexOf(s) !== -1) {
    if (s === "paused" || s === "user_paused") return { on: true, status: "Pausiert" };
    const min = parseNum(remaining?.state);
    if (s === "starting" || s === "delay_wait") return { on: true, status: "Startet" };
    return { on: true, status: min !== null && min > 0 ? `Läuft, noch ${Math.round(min)} min` : "Läuft" };
  }
  if (APPLIANCE_DONE.indexOf(s) !== -1) {
    return { on: false, status: typeof st.lc_ts === "number" ? `Fertig seit ${hhmm(st.lc_ts)}` : "Fertig" };
  }
  if (APPLIANCE_ABORTED.indexOf(s) !== -1) return { on: false, status: "Abgebrochen" };
  return { on: false, status: "Aus" };
}

const VACUUM_TEXT: Record<string, string> = {
  cleaning: "Saugt",
  returning: "Fährt zurück",
  docked: "In der Station",
  idle: "Bereit",
  paused: "Pausiert",
  error: "Fehler",
};

/** Main entity whose availability decides "offline" for an item. */
export function primaryEntity(item: Item): string {
  if (item.kind === "tv" && item.primary) return item.primary;
  if (item.kind === "appliance" && item.state) return item.state;
  return item.id;
}

export function tileView(item: Item, ctx: TileCtx): TileView {
  const { get } = ctx;
  const v = base();

  // Groups and virtual switch groups: derived from members.
  if (item.kind === "group" || item.kind === "switch_group") {
    const members = item.members || [];
    const gst = item.kind === "group" ? get(item.id) : undefined;
    const c = countOn(members, get, isOnState);
    if ((item.kind === "group" && (!gst || gst.state === "unavailable")) || (members.length > 0 && c.avail === 0)) {
      return offline(gst || get(members[0]));
    }
    v.badge = true;
    v.members = { on: c.on, n: c.n };
    v.on = c.on > 0;
    v.status = c.on > 0 ? `${c.on} von ${c.n} an` : "Aus";
    return v;
  }

  const st = get(primaryEntity(item));
  if (!st || st.state === "unavailable") return offline(st);

  switch (item.kind) {
    case "light":
    case "status_led": {
      if (st.state === "unknown") return unknownView();
      v.badge = true;
      v.on = st.state === "on";
      v.status = v.on ? (item.kind === "status_led" ? "An" : lightStatus(st)) : "Aus";
      v.pip = lightPip(st);
      return v;
    }
    case "light_onoff":
    case "input_boolean": {
      if (st.state === "unknown") return unknownView();
      v.badge = true;
      v.on = st.state === "on";
      v.status = v.on ? "An" : "Aus";
      return v;
    }
    case "switch":
    case "switch_critical": {
      if (st.state === "unknown") return unknownView();
      v.badge = true;
      v.on = st.state === "on";
      const power = item.power ? parseNum(get(item.power)?.state) : null;
      v.status = v.on ? (power !== null && power >= 1 ? `An, ${watts(power)}` : "An") : "Aus";
      if (item.kind === "switch_critical" && v.on) {
        v.lock = true;
        v.holdOff = true;
      }
      return v;
    }
    case "cover":
    case "cover_pos":
      v.status = coverStatus(st, item.kind === "cover_pos");
      return v;
    case "climate_tuya": {
      // Tuya thermostats report hvac "unknown" permanently; that is not an error (02 B8).
      const room = item.heating_room && ctx.heating?.rooms ? ctx.heating.rooms[item.heating_room] : undefined;
      const ist = parseNum(room ? get(room.ist)?.state : st.attributes.current_temperature);
      const soll = parseNum(st.attributes.temperature);
      const timer = room?.boost_timer ? get(room.boost_timer) : undefined;
      if (timer && timer.state === "active" && typeof timer.finishes_ts === "number") {
        v.status = `Boost bis ${hhmm(timer.finishes_ts)}`;
      } else {
        v.status = `${temp(ist)} → ${temp(soll)}`;
      }
      return v;
    }
    case "climate": {
      if (st.state === "off") return v;
      const soll = parseNum(st.attributes.temperature);
      v.on = true;
      v.status = st.state === "cool" ? `Kühlt auf ${soll !== null ? Math.round(soll) : "–"}°` : "An";
      return v;
    }
    case "tv":
    case "media": {
      v.badge = true;
      v.on = mediaOn(st);
      if (v.on) {
        const app = st.attributes.app_name || st.attributes.media_title;
        v.status = typeof app === "string" && app ? app : "An";
      }
      return v;
    }
    case "music_room": {
      const mr = ctx.music?.multiroom ? get(ctx.music.multiroom) : undefined;
      if (!isOnState(mr)) return v;
      const muted = st.attributes.is_volume_muted === true;
      const vol = parseNum(st.attributes.volume_level);
      v.badge = true;
      v.on = !muted;
      v.status = muted ? "Stumm" : pct(vol !== null ? vol * 100 : null);
      return v;
    }
    case "multiroom": {
      v.badge = true;
      v.on = st.state === "on";
      if (v.on) {
        const names = (ctx.music?.rooms || [])
          .filter((r) => {
            const rs = get(r.id);
            return rs && rs.state !== "unavailable" && rs.attributes.is_volume_muted !== true;
          })
          .map((r) => r.name);
        v.status = names.length ? names.join(", ") : "An";
      }
      return v;
    }
    case "appliance": {
      const a = applianceStatus(st, item.remaining ? get(item.remaining) : undefined);
      v.on = a.on;
      v.status = a.status;
      return v;
    }
    case "vacuum":
      v.on = st.state === "cleaning" || st.state === "returning";
      v.status = VACUUM_TEXT[st.state] || st.state;
      return v;
  }
  return v;
}

/** Statuses for the popup header ("An, 64 %, 3000 K"). */
export function lightHeadState(st: EntityState | undefined): string {
  if (!st || st.state === "unavailable") return "Offline";
  if (st.state !== "on") return "Aus";
  const parts = ["An"];
  const bri = parseNum(st.attributes.brightness);
  if (bri && bri > 0) parts.push(`${briPct(bri)} %`);
  const mode = st.attributes.color_mode;
  const k = parseNum(st.attributes.color_temp_kelvin);
  if (mode === "color_temp" && k) parts.push(`${Math.round(k / 10) * 10} K`);
  return parts.join(", ");
}
