import { useEffect, useRef, useState } from "react";
import { Icon } from "../controls/icons";
import { Press } from "../controls/Press";
import { undoNow, useNotice } from "../state/notice";
import { useStore } from "../state/store";

const CONN_DELAY_MS = 3000;
const CONN_OK_MS = 1000;

/**
 * Connection hint (04 §5.6 first stage): nothing for 3 s, then amber
 * "Verbindung wird wiederhergestellt …", 1 s green "Verbunden" when back.
 * Stale look, refusal and reloads after 30 s / 5 min follow in P6.
 */
function useConnNotice(): "lost" | "ok" | null {
  const up = useStore((s) => s.connected && s.haConnected);
  const [state, setState] = useState<"lost" | "ok" | null>(null);
  const shown = useRef(false);
  useEffect(() => {
    if (!up) {
      const t = window.setTimeout(() => {
        shown.current = true;
        setState("lost");
      }, CONN_DELAY_MS);
      return () => window.clearTimeout(t);
    }
    if (!shown.current) return;
    shown.current = false;
    setState("ok");
    const t = window.setTimeout(() => setState(null), CONN_OK_MS);
    return () => window.clearTimeout(t);
  }, [up]);
  return up && state === "lost" ? null : state;
}

/**
 * Top notice 456 x 56 at x 552, y 24 (04 §5.2): result of a bulk "off" with
 * "Rückgängig" (128 x 44) and the remaining time as a 2 px line, or the
 * connection state. Sits over the weather, never over clock or date.
 */
export function TopNotice() {
  const notice = useNotice((s) => s.notice);
  const conn = useConnNotice();
  if (notice) {
    const hasUndo = !!notice.undo;
    return (
      <div className={`undo${hasUndo ? "" : " undo--plain"}${notice.tone === "amber" ? " undo--conn" : ""}${notice.tone === "ok" ? " undo--ok" : ""}`} role="status" key={notice.seq}>
        <div className="undo__txt">
          {notice.text}
          {notice.muted ? <span>{` ${notice.muted}`}</span> : null}
          {notice.hint ? <span className="hint">{` · ${notice.hint}`}</span> : null}
        </div>
        {hasUndo ? (
          <Press className="undo__btn" label="Rückgängig" onPress={() => undoNow(notice.undo as string)}>
            <Icon name="undo" />
            Rückgängig
          </Press>
        ) : null}
        {hasUndo ? <i className="undo__time" style={{ animationDuration: `${notice.ms}ms`, WebkitAnimationDuration: `${notice.ms}ms` }} /> : null}
      </div>
    );
  }
  if (conn === "lost") {
    return (
      <div className="undo undo--plain undo--conn" role="status">
        <div className="undo__txt">Verbindung wird wiederhergestellt …</div>
      </div>
    );
  }
  if (conn === "ok") {
    return (
      <div className="undo undo--plain undo--ok" role="status">
        <div className="undo__txt">Verbunden</div>
      </div>
    );
  }
  return null;
}
