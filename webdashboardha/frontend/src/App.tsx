import { useEffect } from "react";
import { connectWs } from "./state/ws";
import { useStore } from "./state/store";
import { useSettingsStore } from "./state/useSettings";
import { setClockOffset, startMinuteClock } from "./state/clock";
import { installIdleTracking, RETURN_MS, useIdleTimer } from "./state/idle";
import { useUi, type Popup, type Screen } from "./state/ui";
import { installGlobalGuards } from "./controls/inputLock";
import { Rail } from "./shell/Rail";
import { NightShade } from "./shell/NightShade";
import { AlertOverlay } from "./shell/AlertOverlay";
import { StartScreen } from "./screens/StartScreen";
import { ZoneScreen } from "./screens/ZoneScreen";
import { AllScreen } from "./screens/AllScreen";
import { PopupHost } from "./dialogs/PopupHost";

/**
 * Deep links for renders and touch tests: ?screen=start|zone:<id>|alle|alle:neu
 * &popup=<id>|covers|contacts|active|service|kg:ambiente|kg:<group id>&now=<ISO>.
 * Only in dev/mock builds (import.meta.env.DEV), never in the add-on bundle.
 */
function applyDeepLink(): void {
  if (!import.meta.env.DEV) return;
  const q = new URLSearchParams(window.location.search);
  const nowIso = q.get("now");
  if (nowIso) {
    const t = new Date(nowIso).getTime();
    if (isFinite(t)) setClockOffset(t - Date.now());
  }
  const screen = q.get("screen");
  let s: Screen | null = null;
  if (screen === "start") s = { t: "start" };
  else if (screen === "alle" || screen === "alle:neu") s = { t: "alle", tab: screen === "alle:neu" ? "neu" : undefined };
  else if (screen && screen.indexOf("zone:") === 0) s = { t: "zone", id: screen.slice(5) };
  if (s) useUi.setState({ screen: s });
  const popup = q.get("popup");
  if (popup) {
    let p: Popup;
    if (popup === "covers" || popup === "contacts" || popup === "active" || popup === "service" || popup === "settings") {
      p = { t: popup };
    } else if (popup === "kg:ambiente") p = { t: "kg", role: "ambiente" };
    else if (popup.indexOf("kg:") === 0) p = { t: "kg", role: "group", id: popup.slice(3) };
    else p = { t: "item", id: popup, name: q.get("name") || undefined };
    useUi.setState({ popup: p });
  }
}

function Content() {
  const board = useStore((s) => s.board);
  const connected = useStore((s) => s.connected);
  const screen = useUi((s) => s.screen);
  if (!board) {
    return (
      <div className="wait" role="status">
        <div className="wait__t">{connected ? "Warte auf Home Assistant …" : "Verbinde mit dem Add-on …"}</div>
        <div className="wait__s">Das Dashboard erscheint, sobald die Verbindung steht.</div>
      </div>
    );
  }
  if (screen.t === "zone") {
    const zone = board.zones.filter((z) => z.id === screen.id)[0];
    if (zone) return <ZoneScreen key={zone.id} zone={zone} />;
  }
  if (screen.t === "alle") return <AllScreen />;
  return <StartScreen />;
}

/** Back to Start after 60 s without touch, and at once when the entrance door opens. */
function useReturnToStart(): void {
  const door = useStore((s) => (s.board?.door_reset ? s.states[s.board.door_reset]?.state : undefined));
  const reset = () => {
    const ui = useUi.getState();
    ui.closePopup();
    if (ui.screen.t !== "start") ui.go({ t: "start" });
    const scroller = document.querySelector(".zone");
    if (scroller) scroller.scrollTop = 0;
  };
  useIdleTimer(RETURN_MS, reset);
  useEffect(() => {
    if (door === "on") reset();
  }, [door]);
}

export default function App() {
  const settings = useSettingsStore((s) => s.settings);

  useEffect(() => {
    applyDeepLink();
    const stops = [installGlobalGuards(), installIdleTracking(), startMinuteClock(), connectWs()];
    useSettingsStore.getState().load();
    return () => stops.forEach((stop) => stop());
  }, []);

  useReturnToStart();

  return (
    <div className="stage">
      <Rail />
      <Content />
      <PopupHost />
      <NightShade settings={settings} />
      <AlertOverlay settings={settings} />
    </div>
  );
}
