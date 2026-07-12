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
