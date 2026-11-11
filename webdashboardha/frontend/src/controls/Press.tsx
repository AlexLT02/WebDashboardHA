import type { CSSProperties, ReactNode } from "react";
import { useTap, type HoldCfg } from "./useTap";

interface Props {
  className?: string;
  style?: CSSProperties;
  onPress?: () => void;
  /** Hold-to-trigger instead of a tap (Alles aus, critical off). */
  hold?: HoldCfg | null;
  disabled?: boolean;
  label?: string;
  /** Marks a control nested inside another gesture element (cover buttons). */
  own?: boolean;
  children?: ReactNode;
}

/**
 * Touch-first button: fires on touchend with the same guards as tiles
 * (useTap). A plain `onClick` would get the synthetic iOS click, which can land
 * on an element that just appeared under the finger.
 */
export function Press({ className, style, onPress, hold, disabled, label, own, children }: Props) {
  const ref = useTap({
    onTap: () => {
      if (!disabled && onPress) onPress();
    },
    hold: disabled ? null : hold,
    pressSelector: disabled ? undefined : ":self",
    disabled: disabled && !hold,
  });
  return (
    <div
      ref={ref}
      className={className}
      style={style}
      role="button"
      aria-label={label}
      aria-disabled={disabled || undefined}
      data-own={own ? "" : undefined}
    >
      {children}
    </div>
  );
}
