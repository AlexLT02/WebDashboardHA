/**
 * Board model as delivered by the backend (GET /api/board, WS "board").
 * Mirrors backend/app/board.py (04 §4.5 plus the P1 additions A5 to A7).
 */

export type Kind =
  | "light"
  | "light_onoff"
  | "group"
  | "switch"
  | "switch_critical"
  | "input_boolean"
  | "switch_group"
  | "status_led"
  | "cover"
  | "cover_pos"
  | "climate_tuya"
  | "climate"
  | "tv"
  | "media"
  | "music_room"
  | "multiroom"
  | "appliance"
  | "vacuum";

export type Func = "licht" | "ambiente" | "medien" | "klima";
export type Tier = "zone" | "all" | "hidden";

export interface LightFeatures {
  brightness?: boolean;
  color?: boolean;
  /** [min, max] kelvin, already clamped by kelvin_min. */
  ct?: [number, number];
  position?: boolean;
}

export interface Item {
  id: string;
  kind: Kind;
  name: string;
  /** Name comes from HA (may exceed 14 characters). */
  name_auto?: boolean;
  zone: string | null;
  func: Func | null;
  tier: Tier;
  order: number | null;
  icon: string;
  count: boolean;
  new: boolean;
  cloud: boolean;
  chip?: boolean;
  inbox?: boolean;
  system?: boolean;
  critical?: boolean;
  power?: string;
  heating_room?: string;
  extra?: string[];
  features?: LightFeatures;
  /** group, switch_group */
  members?: string[];
  mode?: string;
  /** tv */
  primary?: string;
  tv?: string;
  sound?: Record<string, string>;
  lights?: string[];
  /** appliance */
  state?: string;
  remaining?: string;
  progress?: string;
  program?: string;
  phase?: string;
  unload_button?: string;
}

export interface ZoneFacts {
  temp?: string;
  hum?: string;
  openings?: string[];
  climate?: string;
}

export interface Section {
  id: Func;
  name: string;
  items: string[];
}

export interface Zone {
  id: string;
  name: string;
  icon: string;
  vacuum_segment?: number;
  facts: ZoneFacts;
  chips: string[];
  sections: Section[];
  all_only: string[];
  light_targets: string[];
}

export interface KgAmbiente {
  role: "ambiente";
  name: string;
  action: string[];
  count: string[];
}
export interface KgGroup {
  role: "group";
  id: string;
  name: string;
  members: string[];
  features?: LightFeatures;
  cloud?: boolean;
}
export interface KgCovers {
  role: "covers";
  name: string;
  covers: { id: string; short: string }[];
}
export interface KgAllesAus {
  role: "alles_aus";
  name: string;
  script: string;
}
export type KgEntry = KgAmbiente | KgGroup | KgCovers | KgAllesAus;

export interface Favorite {
  id: string;
  name: string;
  kind?: Kind;
}

export interface Contact {
  id: string;
  name: string;
  zone: string;
  alarm_after_s: number;
}

export interface LageCfg {
  key: string;
  name: string;
  icon: string;
  [field: string]: unknown;
}

export interface HeatingRoom {
  climate: string;
  ist: string;
  hum?: string;
  soll_helper?: string;
  reason?: string;
  boost_timer?: string;
}

export interface Heating {
  mode?: string;
  mode_options_shown?: string[];
  rooms?: Record<string, HeatingRoom>;
}

export interface MusicCfg {
  multiroom?: string;
  rooms?: { id: string; name: string; zone?: string }[];
  wake_script?: string;
  echos?: { id: string; name: string }[];
}

export interface InboxRow {
  id: string;
  name: string;
  ha_name?: string;
  device?: string | null;
  model?: string | null;
  area?: string | null;
  suggest?: string | null;
  first_seen?: number | null;
}

export interface Board {
  rev: number;
  zones: Zone[];
  items: Record<string, Item>;
  start: {
    kommen_gehen: KgEntry[];
    favorites: Favorite[];
    head: { outside_temp?: string; weather?: string; forecast?: string };
    lage: LageCfg[];
    lage_trim_order: string[];
  };
  heating: Heating;
  music: MusicCfg;
  door_reset?: string;
  undo_scene_id?: string;
  inbox: InboxRow[];
  hidden: string[];
  orphans: { id: string; where: string }[];
  watch_count?: number;
}

/** Slimmed v2 state (backend slim_state): epoch-ms instead of HA timestamps. */
export interface EntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  /** last_changed as epoch ms. The frontend never parses HA time strings. */
  lc_ts?: number | null;
  /** timer.* only: finishes_at as epoch ms. */
  finishes_ts?: number | null;
}

export type StateGetter = (entityId: string) => EntityState | undefined;
