// Inline-SVG-Icon-Set im Material-Design-Standard (die Pfade entsprechen den
// Material Design Icons, die auch Home Assistant nutzt). Bewusst KEINE Library —
// spart Bundle/RAM fürs iPad Air 1. Alle 24x24, nutzen currentColor.

interface IconProps {
  size?: number;
}

/** Kleiner Helfer: ein Standard-24x24-Icon aus einem Pfad. */
function svg(size: number, d: string) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function LightbulbIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z",
  );
}

export function PowerIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13V3Z",
  );
}

export function ThermometerIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M15,13V5A3,3 0 0,0 9,5V13A5,5 0 1,0 15,13M12,4A1,1 0 0,1 13,5V8H11V5A1,1 0 0,1 12,4Z",
  );
}

export function GaugeIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M12,16A2,2 0 0,1 10,14C10,13.1 10.6,12.3 11.4,12.1L18.5,5L12.4,12.1C12.7,12.4 13,12.9 13,14A2,2 0 0,1 12,16M12,3C13.5,3 15,3.4 16.2,4L14.7,5.5C14,5.2 13,5 12,5A7,7 0 0,0 5,12A7,7 0 0,0 7,16.9C7,17 7.1,17 7.1,17H16.9C17,17 17,17 17,16.9C18.2,15.5 19,13.9 19,12C19,11 18.8,10.1 18.5,9.3L20,7.8C20.6,9 21,10.5 21,12C21,14.4 20.1,16.5 18.7,18.1C18.3,18.5 17.8,18.7 17.2,18.7H6.8C6.2,18.7 5.7,18.5 5.3,18.1C3.9,16.5 3,14.4 3,12A9,9 0 0,1 12,3Z",
  );
}

export function BrightnessIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M12,18V6A6,6 0 0,1 18,12A6,6 0 0,1 12,18M20,15.31L23.31,12L20,8.69V4H15.31L12,0.69L8.69,4H4V8.69L0.69,12L4,15.31V20H8.69L12,23.31L15.31,20H20V15.31Z",
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
  return svg(
    size,
    "M21,3V15.5A3.5,3.5 0 0,1 17.5,19A3.5,3.5 0 0,1 14,15.5A3.5,3.5 0 0,1 17.5,12C18.04,12 18.5,12.1 19,12.29V6.81L9,8.6V17.5A3.5,3.5 0 0,1 5.5,21A3.5,3.5 0 0,1 2,17.5A3.5,3.5 0 0,1 5.5,14C6.04,14 6.5,14.1 7,14.29V6L21,3Z",
  );
}

export function FanIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11M12.5,2C17,2 17.11,5.57 14.75,6.75C13.76,7.24 13.32,8.29 13.13,9.22C13.61,9.42 14.03,9.73 14.35,10.13C18.05,8.13 22.03,8.92 22.03,12.5C22.03,17 18.46,17.1 17.28,14.73C16.78,13.74 15.72,13.3 14.79,13.11C14.59,13.59 14.28,14 13.88,14.34C15.87,18.03 15.08,22 11.5,22C7,22 6.91,18.42 9.27,17.24C10.25,16.75 10.69,15.71 10.89,14.79C10.4,14.59 9.97,14.27 9.65,13.87C5.96,15.85 2,15.07 2,11.5C2,7 5.56,6.89 6.74,9.26C7.24,10.25 8.29,10.68 9.22,10.87C9.41,10.39 9.73,9.97 10.14,9.65C8.15,5.96 8.94,2 12.5,2Z",
  );
}

export function DropletIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M12,20A6,6 0 0,1 6,14C6,10 12,3.25 12,3.25C12,3.25 18,10 18,14A6,6 0 0,1 12,20Z",
  );
}

export function DoorIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M8,3C6.89,3 6,3.89 6,5V21H18V5C18,3.89 17.11,3 16,3H8M13,11H15V13H13V11Z",
  );
}

export function WindowIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M4,4H20V20H4V4M6,6V11H11V6H6M13,6V11H18V6H13M6,13V18H11V13H6M13,13V18H18V13H13Z",
  );
}

export function MotionIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M13.5,5.5C14.59,5.5 15.5,4.59 15.5,3.5C15.5,2.39 14.59,1.5 13.5,1.5C12.39,1.5 11.5,2.39 11.5,3.5C11.5,4.59 12.39,5.5 13.5,5.5M9.89,19.38L10.89,15L13,17V23H15V15.5L12.89,13.5L13.5,10.5C14.79,12 16.79,13 19,13V11C17.09,11 15.5,10 14.69,8.58L13.69,7C13.29,6.38 12.69,6 12,6C11.69,6 11.5,6.08 11.19,6.08L6,8.28V13H8V9.58L9.79,8.88L8.19,17L3.29,16L2.89,18L9.89,19.38Z",
  );
}

export function LockIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z",
  );
}

export function PlugIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M16,7V3H14V7H10V3H8V7C7.89,7 7,7.89 7,9V14.5L10.5,18V21H13.5V18L17,14.5V9C17,7.89 16.11,7 16,7Z",
  );
}

export function CalendarIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M19,19H5V8H19M16,1V3H8V1H6V3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3H18V1M17,12H12V17H17V12Z",
  );
}

export function ClockIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12.5,7H11V13L15.75,15.85L16.5,14.62L12.5,12.25V7Z",
  );
}

export function TvIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M21,3H3C1.89,3 1,3.89 1,5V17A2,2 0 0,0 3,19H8V21H16V19H21A2,2 0 0,0 23,17V5C23,3.89 22.1,3 21,3M21,17H3V5H21V17Z",
  );
}

export function SpeakerIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M12,12A3,3 0 0,0 9,15A3,3 0 0,0 12,18A3,3 0 0,0 15,15A3,3 0 0,0 12,12M12,20A5,5 0 0,1 7,15A5,5 0 0,1 12,10A5,5 0 0,1 17,15A5,5 0 0,1 12,20M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8C10.89,8 10,7.1 10,6C10,4.89 10.89,4 12,4M17,2H7C5.89,2 5,2.89 5,4V20A2,2 0 0,0 7,22H17A2,2 0 0,0 19,20V4C19,2.89 18.1,2 17,2Z",
  );
}

export function ClimateIcon({ size = 24 }: IconProps) {
  // Klimaanlage: Einheit mit Lamellenschlitz (evenodd-Loch) + Luftauslass-Striche.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M3,6.5A1.5,1.5 0 0,1 4.5,5H19.5A1.5,1.5 0 0,1 21,6.5V10.5A1.5,1.5 0 0,1 19.5,12H4.5A1.5,1.5 0 0,1 3,10.5V6.5Z M5.5,8.5H18.5V9.5H5.5Z M7,15H9V19H7Z M11,15H13V19H11Z M15,15H17V19H15Z"
      />
    </svg>
  );
}

export function BlindsIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M3,3H21V5H3V3M4,7H20V9H4V7M4,11H20V13H4V11M4,15H20V17H4V15M11,19H13V22H11V19Z",
  );
}

export function GarageIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M22,9V20H19V11H5V20H2V9L12,5L22,9M18,12V13H6V12H18M18,14V15H6V14H18M18,16V17H6V16H18M18,18V19H6V18H18Z",
  );
}

export function CameraIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M4,4H7L9,2H15L17,4H20A2,2 0 0,1 22,6V18A2,2 0 0,1 20,20H4A2,2 0 0,1 2,18V6A2,2 0 0,1 4,4M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9Z",
  );
}

export function VacuumIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A1.5,1.5 0 0,1 13.5,7.5A1.5,1.5 0 0,1 12,9A1.5,1.5 0 0,1 10.5,7.5A1.5,1.5 0 0,1 12,6M5.6,13H18.4A6.5,6.5 0 0,1 12,18.5A6.5,6.5 0 0,1 5.6,13Z",
  );
}

export function CoffeeIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M2,21V19H20V21H2M20,8V5H18V8H20M20,3A2,2 0 0,1 22,5V8A2,2 0 0,1 20,10H18V13A4,4 0 0,1 14,17H8A4,4 0 0,1 4,13V3H20M16,5H6V13A2,2 0 0,0 8,15H14A2,2 0 0,0 16,13V5Z",
  );
}

export function WifiIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M12,21L15.6,16.2C14.6,15.45 13.35,15 12,15C10.65,15 9.4,15.45 8.4,16.2L12,21M12,3C7.95,3 4.21,4.34 1.2,6.6L3,9C5.5,7.12 8.62,6 12,6C15.38,6 18.5,7.12 21,9L22.8,6.6C19.79,4.34 16.05,3 12,3M12,9C9.3,9 6.81,9.89 4.8,11.4L6.6,13.8C8.1,12.67 9.97,12 12,12C14.03,12 15.9,12.67 17.4,13.8L19.2,11.4C17.19,9.89 14.7,9 12,9Z",
  );
}

export function BatteryIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M16.67,4H15V2H9V4H7.33A1.33,1.33 0 0,0 6,5.33V20.67C6,21.4 6.6,22 7.33,22H16.67A1.33,1.33 0 0,0 18,20.67V5.33C18,4.6 17.4,4 16.67,4Z",
  );
}

export function PlantIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z",
  );
}

export function HeaterIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M7.95,3L6.53,5.19L7.95,7.4L7.06,8.76L5.18,5.87L6.6,3.68L5.95,3H7.95M11.95,3L10.53,5.19L11.95,7.4L11.06,8.76L9.18,5.87L10.6,3.68L9.95,3H11.95M15.95,3L14.53,5.19L15.95,7.4L15.06,8.76L13.18,5.87L14.6,3.68L13.95,3H15.95M17,10H22V12H21V21H19V19H5V21H3V12H2V10H7L7.66,11H16.34L17,10M19,17V12H5V17H19Z",
  );
}

export function FridgeIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M7,2H17A2,2 0 0,1 19,4V20A2,2 0 0,1 17,22H7A2,2 0 0,1 5,20V4A2,2 0 0,1 7,2M7,4V9H17V4H7M17,20V11H7V20H17M8,5.5H10V8H8V5.5M8,12.5H10V16H8V12.5Z",
  );
}

export function WasherIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M18,2.01L6,2C4.89,2 4,2.89 4,4V20C4,21.11 4.89,22 6,22H18C19.11,22 20,21.11 20,20V4C20,2.89 19.11,2.01 18,2.01M18,20H6V8H18V20M18,6H6V4H18V6M7.5,5C8.05,5 8.5,4.55 8.5,4C8.5,3.45 8.05,3 7.5,3C6.95,3 6.5,3.45 6.5,4C6.5,4.55 6.95,5 7.5,5M10.5,5C11.05,5 11.5,4.55 11.5,4C11.5,3.45 11.05,3 10.5,3C9.95,3 9.5,3.45 9.5,4C9.5,4.55 9.95,5 10.5,5M12,9A5,5 0 0,0 7,14A5,5 0 0,0 12,19A5,5 0 0,0 17,14A5,5 0 0,0 12,9M12,17C10.34,17 9,15.66 9,14C9,12.34 10.34,11 12,11C13.66,11 15,12.34 15,14C15,15.66 13.66,17 12,17Z",
  );
}

export function SunIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.16,19 12,19C12.84,19 13.65,18.85 14.39,18.58L12,22Z",
  );
}

export function BedIcon({ size = 24 }: IconProps) {
  return svg(
    size,
    "M19,7H11V14H3V5H1V20H3V17H21V20H23V11A4,4 0 0,0 19,7M7,13A3,3 0 0,0 10,10A3,3 0 0,0 7,7A3,3 0 0,0 4,10A3,3 0 0,0 7,13Z",
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
