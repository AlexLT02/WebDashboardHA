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

/** Benannte Icon-Registry — für Auto-Zuweisung UND manuelle Auswahl. */
export const ICONS: Record<string, (p: IconProps) => JSX.Element> = {
  light: LightbulbIcon,
  power: PowerIcon,
  plug: PlugIcon,
  fan: FanIcon,
  thermometer: ThermometerIcon,
  droplet: DropletIcon,
  door: DoorIcon,
  window: WindowIcon,
  motion: MotionIcon,
  lock: LockIcon,
  music: MusicIcon,
  gauge: GaugeIcon,
  clock: ClockIcon,
  calendar: CalendarIcon,
};

export const ICON_KEYS = Object.keys(ICONS);

/** Icon-Komponente: manueller Override (options.icon) vor Auto-Zuweisung. */
export function resolveIcon(
  override: string | undefined,
  domain: string,
  deviceClass?: string,
): (p: IconProps) => JSX.Element {
  if (override && ICONS[override]) return ICONS[override];
  return ICONS[autoIconKey(domain, deviceClass)] ?? GaugeIcon;
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
