import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "../controls/icons";
import { Press } from "../controls/Press";
import { ghostMouse } from "../controls/inputLock";
import { POPUP_MS, useIdleTimer } from "../state/idle";
import { useUi } from "../state/ui";
import "./dialogs.css";

export const BACKDROP_DELAY_MS = 350;

export interface HeadBadge {
  icon: string;
  on: boolean;
  offline?: boolean;
  /** Tap on the badge switches like the tile icon. */
  onToggle?: () => void;
  /** Hold instead of a tap (critical socket off). */
  holdOff?: { ms: number; onFire: () => void; onShort: () => void } | null;
}

interface Props {
  name: string;
  state?: string;
  stateOn?: boolean;
  badge?: HeadBadge;
  foot?: string;
  children?: ReactNode;
  /** Auto close after this much inactivity (30 s; music/vacuum 60 s in P4). */
  idleMs?: number;
  /** Service panel: aligned left next to the rail instead of centred. */
  left?: boolean;
}

/**
 * Popup frame (04 §5.2): 440 wide, max 680 high, never scrolls, ✕ 44 x 44.
 * The scrim swallows taps (preventDefault on touchend so nothing below fires)
 * and only closes after 350 ms, so the finger that opened the popup by holding
 * cannot close it again on release.
 */
export function Dialog({ name, state, stateOn, badge, foot, children, idleMs = POPUP_MS, left }: Props) {
  const closing = useUi((s) => s.closing);
  const close = useUi((s) => s.closePopup);
  const scrimRef = useRef<HTMLDivElement>(null);
  const openedAt = useRef(Date.now());

  useIdleTimer(idleMs, close);

  useEffect(() => {
    const el = scrimRef.current;
    if (!el) return;
    let startedOnScrim = false;
    const ready = () => Date.now() - openedAt.current >= BACKDROP_DELAY_MS;
    const onStart = (e: TouchEvent) => {
      startedOnScrim = e.target === el;
    };
    const onEnd = (e: TouchEvent) => {
      if (e.target === el) {
        if (e.cancelable) e.preventDefault();
        if (startedOnScrim && ready()) close();
      }
      startedOnScrim = false;
    };
    const onClick = (e: MouseEvent) => {
      if (e.target === el && !ghostMouse() && ready()) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc") close();
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: false });
    el.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [close]);

  const badgeCls = badge ? `badge${badge.offline ? " is-offline" : badge.on ? " is-on" : ""}` : "";

  return (
    <div ref={scrimRef} className={`scrim${closing ? " is-closing" : ""}`}>
      <div className={`popup${left ? " popup--left" : ""}`} role="dialog" aria-label={name}>
        <div className="popup__head">
          {badge ? (
            badge.onToggle || badge.holdOff ? (
              <Press
                className={badgeCls}
                label={`${name} schalten`}
                onPress={badge.onToggle}
                hold={badge.holdOff ? { ...badge.holdOff, zone: "all" } : null}
              >
                <Icon name={badge.icon} />
              </Press>
            ) : (
              <div className={`${badgeCls} badge--bare`}>
                <Icon name={badge.icon} />
              </div>
            )
          ) : null}
          <div className="popup__name" style={badge ? undefined : { left: 24 }}>
            {name}
          </div>
          {state ? (
            <div className={`popup__state${stateOn ? " on" : ""}`} style={badge ? undefined : { left: 24 }}>
              {state}
            </div>
          ) : null}
          <Press className="popup__x" label="Schließen" onPress={close}>
            <Icon name="close" />
          </Press>
        </div>
        {children}
        {foot ? <div className="popup__foot">{foot}</div> : null}
      </div>
    </div>
  );
}
