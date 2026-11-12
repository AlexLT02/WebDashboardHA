import { useEffect } from "react";
import { create } from "zustand";
import { useStore } from "./store";
import { showText } from "./notice";

/**
 * Connection stages (04 §5.6). < 3 s nothing; 3–30 s amber TopNotice (TopNotice.tsx);
 * > 30 s stale: root class `is-stale`, every command is refused with
 * "Offline, nichts gesendet" (no queue, a late "Licht an" is worse than none);
 * > 5 min reload, and again every 5 min because the timer restarts after it.
 */
export const STALE_MS = 30000;
export const RELOAD_MS = 300000;

export const useConn = create<{ stale: boolean }>(() => ({ stale: false }));

export function isStale(): boolean {
  return useConn.getState().stale;
}

/** True (and shows the notice) when a command must not go out. */
export function refuseIfStale(): boolean {
  if (!isStale()) return false;
  showText("Offline, nichts gesendet", "amber");
  return true;
}

export function useConnWatch(): void {
  const up = useStore((s) => s.connected && s.haConnected);
  useEffect(() => {
    if (up) {
      useConn.setState({ stale: false });
      return;
    }
    const stale = window.setTimeout(() => useConn.setState({ stale: true }), STALE_MS);
    const reload = window.setTimeout(() => window.location.reload(), RELOAD_MS);
    return () => {
      window.clearTimeout(stale);
      window.clearTimeout(reload);
    };
  }, [up]);
}
