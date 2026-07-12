// Minimales Inline-SVG-Icon-Set (keine Icon-Library — spart Bundle/RAM fürs iPad).
// Alle 24x24, nutzen currentColor.

interface IconProps {
  size?: number;
}

export function LightbulbIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" />
    </svg>
  );
}

export function PowerIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13 3h-2v10h2V3zm4.83 2.17-1.42 1.42A6.92 6.92 0 0 1 19 12a7 7 0 0 1-14 0c0-2.22 1.04-4.19 2.65-5.44L6.24 5.17A8.96 8.96 0 0 0 3 12a9 9 0 0 0 18 0c0-2.74-1.23-5.19-3.17-6.83z" />
    </svg>
  );
}

export function ThermometerIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M15 13V5a3 3 0 0 0-6 0v8a5 5 0 1 0 6 0zm-3-9a1 1 0 0 1 1 1v3h-2V5a1 1 0 0 1 1-1z" />
    </svg>
  );
}

export function GaugeIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 4a8 8 0 0 0-8 8 8 8 0 0 0 2.34 5.66l1.42-1.42A6 6 0 0 1 6 12a6 6 0 0 1 12 0 6 6 0 0 1-1.76 4.24l1.42 1.42A8 8 0 0 0 20 12a8 8 0 0 0-8-8zm-1 4v5a1 1 0 1 0 2 0V8h-2z" />
    </svg>
  );
}

export function BrightnessIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 7a5 5 0 0 0 0 10V7z" opacity="0.55" />
      <path d="M12 4a1 1 0 0 1 1 1v.05a7 7 0 0 1 0 13.9V19a1 1 0 0 1-2 0v-.05a7 7 0 0 1 0-13.9V5a1 1 0 0 1 1-1zm0 3a5 5 0 1 0 0 10A5 5 0 0 0 12 7z" />
    </svg>
  );
}

// Bunter Ring als Farb-Modus-Icon (linearer Gradient — Safari-12-tauglich, kein conic).
export function ColorRingIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="cr" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff5a5a" />
          <stop offset="0.33" stopColor="#ffd24c" />
          <stop offset="0.66" stopColor="#4cd07d" />
          <stop offset="1" stopColor="#4c8dff" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9" fill="url(#cr)" />
      <circle cx="12" cy="12" r="3.2" fill="#1a1d24" />
    </svg>
  );
}

export function MusicIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
    </svg>
  );
}

export function FanIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm0-9c2 0 3 1.5 3 3 0 1.2-.7 2-1.5 3.2C15 8 16.5 7.5 18 8c1.7.6 2.3 2.3 1.7 3.7-.5 1.1-1.6 1.6-3 1.6 1.2.6 2.1 1.4 2.1 2.9 0 1.8-1.4 2.8-3 2.8-1.2 0-2-.7-3-1.8.1 1.4-.3 3-2 3.5-1.7.5-3.2-.6-3.4-2.2-.1-1.2.5-2 1.6-2.9-1.4 0-2.8-.5-3.3-1.9C1.6 12 2.5 10.4 4 10c1.2-.3 2.1.1 3.2.9C6.5 9.6 6 8.5 6.4 7 6.9 5.4 8.5 4.7 10 5.2c-.6-.9-1-1.7-1-2.7C9 1 10.3 2 12 2z" />
    </svg>
  );
}
export function DropletIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3s6 6.5 6 10.5A6 6 0 0 1 6 13.5C6 9.5 12 3 12 3z" />
    </svg>
  );
}
export function DoorIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 3h10a1 1 0 0 1 1 1v16h2v2H3v-2h2V4a1 1 0 0 1 1-1zm8 8h-2v2h2v-2z" />
    </svg>
  );
}
export function WindowIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 4h16v16H4V4zm2 2v5h5V6H6zm7 0v5h5V6h-5zm-7 7v5h5v-5H6zm7 0v5h5v-5h-5z" />
    </svg>
  );
}
export function MotionIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-2 5-4 2 .8 2 2.4-1.1L9 12l-3 8h2.2l2-5 2 2v3H14v-4l-2-2 .6-3c1 1.2 2.4 2 4.4 2v-2c-1.6 0-2.9-.8-3.6-2l-1-1.6C11 8.3 10.4 8 9.8 8H11z" />
    </svg>
  );
}
export function LockIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3H9z" />
    </svg>
  );
}
export function PlugIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9 2v6H7V2H5v6a4 4 0 0 0 3 3.9V16a2 2 0 0 0 2 2h1v4h2v-4h1a2 2 0 0 0 2-2v-4.1A4 4 0 0 0 19 8V2h-2v6h-2V2H9z" />
    </svg>
  );
}
export function CalendarIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zM5 9h14v10H5V9z" />
    </svg>
  );
}
export function ClockIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 10V6h-2v7h6v-2h-4z" />
    </svg>
  );
}

export function TvIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7v2h3v2H7v-2h3v-2H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v9h16V6H4z" />
    </svg>
  );
}
export function SpeakerIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm5 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
    </svg>
  );
}
export function ClimateIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3 3 5H9l3-5zm-4 8h8a4 4 0 0 1-8 0z" />
    </svg>
  );
}
export function BlindsIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 3h18v2H3V3zm1 4h16v2H4V7zm0 4h16v2H4v-2zm0 4h16v2H4v-2zm7 4h2v3h-2v-3z" />
    </svg>
  );
}
export function GarageIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3 3 7v14h2V9h14v12h2V7l-9-4zm-5 9h10v2H7v-2zm0 4h10v2H7v-2z" />
    </svg>
  );
}
export function CameraIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9 4h6l1.5 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5L9 4zm3 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
    </svg>
  );
}
export function VacuumIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM6 13h12a6 6 0 0 1-12 0z" />
    </svg>
  );
}
export function CoffeeIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 8h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8zm13 0h2a3 3 0 0 1 0 6h-2V8zM4 20h13v2H4v-2z" />
    </svg>
  );
}
export function WifiIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0-5c1.7 0 3.2.7 4.3 1.8l-1.8 1.8a3.5 3.5 0 0 0-5 0l-1.8-1.8A6 6 0 0 1 12 13zm0-5c3 0 5.8 1.2 7.8 3.2l-1.8 1.8A8.5 8.5 0 0 0 6 13l-1.8-1.8A11 11 0 0 1 12 8z" />
    </svg>
  );
}
export function BatteryIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M5 6h12a2 2 0 0 1 2 2v1h2v6h-2v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm1 3v6h10V9H6z" />
    </svg>
  );
}
export function PlantIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 12c0-4 3-7 8-7 0 5-3 8-7 8h-1zm0 0C12 9 9 6 4 6c0 4 3 6 7 6h1zm-2 2h4l-1 8h-2l-1-8z" />
    </svg>
  );
}
export function HeaterIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 6h2v12H4V6zm4 0h2v12H8V6zm4 0h2v12h-2V6zm4 0h2v12h-2V6zM3 18h18v2H3v-2z" />
    </svg>
  );
}
export function FridgeIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 2h12a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm1 2v5h10V4H7zm0 7v9h10v-9H7zm2-6h2v2H9V5zm0 8h2v3H9v-3z" />
    </svg>
  );
}
export function WasherIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M5 2h14a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm2 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm5 3a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 2a4 4 0 0 1 0 8 4 4 0 0 1 0-8z" />
    </svg>
  );
}
export function SunIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5 2 2-2 2-2-2 2-2zm0 16 2 2-2 2-2-2 2-2zM2 12l2-2 2 2-2 2-2-2zm16 0 2-2 2 2-2 2-2-2z" />
    </svg>
  );
}
export function BedIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M2 6h2v6h16V9a3 3 0 0 0-3-3H9a3 3 0 0 0-3 3v1H4V6H2zm0 8h20v4h-2v-2H4v2H2v-4z" />
    </svg>
  );
}

/** Benannte Icon-Registry — für Auto-Zuweisung UND manuelle Auswahl. */
export const ICONS: Record<string, (p: IconProps) => JSX.Element> = {
  light: LightbulbIcon,
  bed: BedIcon,
  power: PowerIcon,
  plug: PlugIcon,
  fan: FanIcon,
  heater: HeaterIcon,
  climate: ClimateIcon,
  thermometer: ThermometerIcon,
  droplet: DropletIcon,
  sun: SunIcon,
  door: DoorIcon,
  window: WindowIcon,
  blinds: BlindsIcon,
  garage: GarageIcon,
  motion: MotionIcon,
  lock: LockIcon,
  camera: CameraIcon,
  music: MusicIcon,
  speaker: SpeakerIcon,
  tv: TvIcon,
  coffee: CoffeeIcon,
  fridge: FridgeIcon,
  washer: WasherIcon,
  vacuum: VacuumIcon,
  plant: PlantIcon,
  wifi: WifiIcon,
  battery: BatteryIcon,
  gauge: GaugeIcon,
  clock: ClockIcon,
  calendar: CalendarIcon,
};

/** Schlüsselwörter im Gerätenamen → Icon (DE + EN). Reihenfolge = Priorität. */
const NAME_KEYWORDS: [RegExp, string][] = [
  [/\b(fernseh|fernseher|tv|beamer)/i, "tv"],
  [/\b(sonos|lautsprecher|speaker|boxen|echo|homepod)/i, "speaker"],
  [/\b(spotify|musik|music|radio|player)/i, "music"],
  [/\b(kaffee|coffee|espresso)/i, "coffee"],
  [/\b(kühl|fridge|gefrier|freezer)/i, "fridge"],
  [/\b(wasch|washer|trockner|dryer|spülmasch|dishwash)/i, "washer"],
  [/\b(saug|vacuum|roomba|robo)/i, "vacuum"],
  [/\b(rollo|rolladen|rollladen|jalousie|blind|cover|vorhang|shutter)/i, "blinds"],
  [/\b(garage|tor)/i, "garage"],
  [/\b(kamera|camera|cam)/i, "camera"],
  [/\b(router|wlan|wifi|fritz|netzwerk|network)/i, "wifi"],
  [/\b(pflanze|plant|blume|garten|garden)/i, "plant"],
  [/\b(heiz|heater|radiator|therm|klima|climate|ac)/i, "heater"],
  [/\b(bett|bed|schlaf|nachttisch)/i, "bed"],
  [/\b(sonne|sun|solar|pv)/i, "sun"],
  [/\b(steckdose|socket|outlet|plug|stecker)/i, "plug"],
  [/\b(schloss|lock|tür.*schloss|door.*lock)/i, "lock"],
  [/\b(tür|door)/i, "door"],
  [/\b(fenster|window)/i, "window"],
  [/\b(bewegung|motion|präsenz|presence)/i, "motion"],
  [/\b(temperatur|temperature|temp)/i, "thermometer"],
  [/\b(feucht|humidity|luftfeucht)/i, "droplet"],
  [/\b(batterie|battery|akku)/i, "battery"],
  [/\b(ventilator|lüfter|fan)/i, "fan"],
  [/\b(decke|ceiling|lampe|licht|light|leuchte|strahler)/i, "light"],
];

/** „Schlaue" Icon-Wahl: Schlüsselwörter im Namen zuerst, dann Domain/device_class. */
export function smartIconKey(name: string | undefined, domain: string, deviceClass?: string): string {
  if (name) {
    for (const [re, key] of NAME_KEYWORDS) {
      if (re.test(name)) return key;
    }
  }
  return autoIconKey(domain, deviceClass);
}

export const ICON_KEYS = Object.keys(ICONS);

/** Icon-Komponente: manueller Override (options.icon) vor schlauer Namens-/Auto-Wahl. */
export function resolveIcon(
  override: string | undefined,
  domain: string,
  deviceClass?: string,
  name?: string,
): (p: IconProps) => JSX.Element {
  if (override && ICONS[override]) return ICONS[override];
  return ICONS[smartIconKey(name, domain, deviceClass)] ?? GaugeIcon;
}

/** Automatischer Icon-Schlüssel aus Domain + device_class. */
export function autoIconKey(domain: string, deviceClass?: string): string {
  if (domain === "light") return "light";
  if (domain === "fan") return "fan";
  if (domain === "media_player") return "music";
  if (domain === "switch" || domain === "input_boolean") return "power";
  if (domain === "weather") return "gauge";
  if (domain === "binary_sensor" || domain === "sensor") {
    switch (deviceClass) {
      case "motion":
      case "occupancy":
      case "presence":
        return "motion";
      case "door":
      case "garage_door":
      case "opening":
        return "door";
      case "window":
        return "window";
      case "moisture":
      case "humidity":
        return "droplet";
      case "temperature":
        return "thermometer";
      case "lock":
        return "lock";
      case "power":
      case "plug":
      case "outlet":
        return "plug";
    }
  }
  return "gauge";
}

export function iconForType(type: string) {
  switch (type) {
    case "light":
      return LightbulbIcon;
    case "switch":
      return PowerIcon;
    case "sensor":
      return ThermometerIcon;
    default:
      return GaugeIcon;
  }
}
