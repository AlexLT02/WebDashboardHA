/**
 * Content of the top notice (04 §5.2 TopNotice): result of a bulk "off" with
 * "Rückgängig", or a short text. One slot, the newest wins.
 */
import { create } from "zustand";
import { actionUndo, ApiError, type OffResult, type OffScope } from "./api";

export type NoticeTone = "plain" | "amber" | "ok";

export interface Notice {
  seq: number;
  text: string;
  /** Muted amount after the text ("2 Lampen"). */
  muted?: string;
  /** Amber context ("Fenster Bad offen"). */
  hint?: string;
  tone: NoticeTone;
  undo?: string | null;
  /** Lifetime in ms (drives the remaining-time line for undo). */
  ms: number;
}

interface NoticeStore {
  notice: Notice | null;
}

export const useNotice = create<NoticeStore>(() => ({ notice: null }));

let seq = 0;
let timer: number | undefined;

function show(n: Omit<Notice, "seq">): void {
  seq += 1;
  useNotice.setState({ notice: { ...n, seq } });
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    const cur = useNotice.getState().notice;
    if (cur && cur.seq === seq) useNotice.setState({ notice: null });
  }, n.ms);
}

export function hideNotice(): void {
  window.clearTimeout(timer);
  useNotice.setState({ notice: null });
}

export function showText(text: string, tone: NoticeTone = "plain", ms = 2500): void {
  show({ text, tone, ms });
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Texts for the result of /api/actions/off (D3, 02 §3). */
export function offNoticeText(scope: OffScope, res: OffResult): Pick<Notice, "text" | "muted" | "hint"> {
  if (res.count === 0) return { text: "Schon alles aus" };
  const lamps = scope.scope === "zone" || scope.scope === "lights";
  const amount = lamps ? plural(res.count, "Lampe", "Lampen") : plural(res.count, "Gerät", "Geräte");
  const out: Pick<Notice, "text" | "muted" | "hint"> =
    scope.scope === "alles_aus" ? { text: `${amount} aus` } : { text: res.label, muted: amount };
  const hints: string[] = [];
  if (res.hint) hints.push(res.hint);
  if (res.partial) hints.push("Rückgängig nur Licht und Steckdosen");
  if (hints.length) out.hint = hints.join(" · ");
  return out;
}

export function showOffResult(scope: OffScope, res: OffResult): void {
  const texts = offNoticeText(scope, res);
  if (res.count === 0) {
    show({ ...texts, tone: "plain", ms: 2500 });
    return;
  }
  const ms = res.undo && res.expires_in > 0 ? res.expires_in * 1000 : 3000;
  show({ ...texts, tone: "plain", undo: res.undo, ms });
}

export function undoNow(token: string): void {
  hideNotice();
  actionUndo(token).then(
    () => showText("Rückgängig gemacht", "ok", 1500),
    (e) => showText(e instanceof ApiError && e.status === 410 ? "Rückgängig abgelaufen" : "Fehlgeschlagen", "amber"),
  );
}
