import { Icon } from "../controls/icons";
import { Press } from "../controls/Press";
import { useMinute } from "../state/clock";
import { useRailCounts } from "../state/counts";
import { useStore } from "../state/store";
import { useUi, type Screen } from "../state/ui";

function isActive(screen: Screen, id: string): boolean {
  if (id === "start") return screen.t === "start";
  if (id === "alle") return screen.t === "alle";
  return screen.t === "zone" && screen.id === id;
}

/** Zone rail (04 §5.2): Start, five zones, Alle and System at the bottom. */
export function Rail() {
  const zones = useStore((s) => s.board?.zones);
  const inbox = useStore((s) => (s.board ? s.board.inbox.length : 0));
  const screen = useUi((s) => s.screen);
  const go = useUi((s) => s.go);
  const openPopup = useUi((s) => s.openPopup);
  const minute = useMinute();
  const counts = useRailCounts(minute);

  const item = (id: string, icon: string, label: string, onPress: () => void, extra?: JSX.Element | null) => (
    <Press key={id} className={`rail__item${isActive(screen, id) ? " is-active" : ""}`} label={label} onPress={onPress}>
      {counts.alarm[id] ? <i className="rail__dot" /> : null}
      <Icon name={icon} />
      {extra}
      <span className="rail__label">{label}</span>
    </Press>
  );

  return (
    <nav className="rail">
      {item("start", "home", "Start", () => go({ t: "start" }))}
      {(zones || []).map((z) =>
        item(
          z.id,
          z.icon,
          z.name,
          () => go({ t: "zone", id: z.id }),
          counts.on[z.id] ? <span className="rail__count">{counts.on[z.id]}</span> : null,
        ),
      )}
      <div className="rail__bottom">
        {item("alle", "grid", "Alle", () => go({ t: "alle" }), inbox ? <span className="rail__new">{`+${inbox}`}</span> : null)}
        {item("system", "cog", "System", () => openPopup({ t: "service" }))}
      </div>
    </nav>
  );
}
