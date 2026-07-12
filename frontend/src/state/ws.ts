import { wsUrl } from "./basePath";
import { useStore, type EntityState } from "./store";

type ServerMessage =
  | { type: "snapshot"; states: Record<string, EntityState>; ha_connected?: boolean }
  | { type: "state"; entity_id: string; state: EntityState | null };

/**
 * WebSocket-Client zum Backend mit automatischem Reconnect.
 * Empfängt Snapshots + State-Deltas und schreibt sie in den Store.
 */
export function connectWs(): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let backoff = 1000;
  let reconnectTimer: number | undefined;

  const open = () => {
    if (closed) return;
    ws = new WebSocket(wsUrl("/ws"));

    ws.onopen = () => {
      backoff = 1000;
      useStore.getState().setConnected(true);
    };

    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      const store = useStore.getState();
      if (msg.type === "snapshot") {
        store.applySnapshot(msg.states, Boolean(msg.ha_connected));
      } else if (msg.type === "state") {
        store.applyState(msg.entity_id, msg.state);
      }
    };

    ws.onclose = () => {
      useStore.getState().setConnected(false);
      if (closed) return;
      reconnectTimer = window.setTimeout(open, backoff);
      backoff = Math.min(backoff * 2, 15000);
    };

    ws.onerror = () => {
      // onclose übernimmt den Reconnect.
      ws?.close();
    };
  };

  open();

  // Cleanup-Funktion.
  return () => {
    closed = true;
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    ws?.close();
  };
}
