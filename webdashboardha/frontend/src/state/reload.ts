import { useEffect } from "react";
import { useStore } from "./store";
import { useUi } from "./ui";
import { useMinute } from "./clock";

declare const __APP_VERSION__: string | undefined;

/** Version of this bundle (Vite `define`, from backend/app/__init__.py). Empty in tests. */
export const BUILD_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "";

const LOADED_AT = new Date();

/** Daily reload at 04:00: due once the first 04:00 after page load has passed. */
export function nightlyDue(loadedAt: Date, now: Date): boolean {
  const four = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 4, 0, 0, 0).getTime();
  return now.getTime() >= four && loadedAt.getTime() < four;
}

/** Reload when the backend runs a different version, at most once per version. */
export function versionReloadDue(serverVersion: string | null, build: string, lastTried: string | null): boolean {
  if (!serverVersion || !build || serverVersion === build) return false;
  return lastTried !== serverVersion;
}

function busy(): boolean {
  const ui = useUi.getState();
  return Boolean(ui.popup) || ui.editing;
}

export function useReloads(): void {
  const minute = useMinute();
  const version = useStore((s) => s.version);

  useEffect(() => {
    if (!busy() && nightlyDue(LOADED_AT, new Date())) window.location.reload();
  }, [minute]);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    let last: string | null = null;
    try {
      last = window.sessionStorage.getItem("wdh_reload_for");
    } catch {
      return;
    }
    if (!versionReloadDue(version, BUILD_VERSION, last)) return;
    try {
      window.sessionStorage.setItem("wdh_reload_for", version as string);
    } catch {
      return;
    }
    window.location.reload();
  }, [version]);
}
