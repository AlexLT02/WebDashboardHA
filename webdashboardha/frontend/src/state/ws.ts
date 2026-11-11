import { wsUrl } from "./basePath";
import { useStore } from "./store";
import type { Board, EntityState } from "./model";

type ServerMessage =
  | { type: "hello"; version: string; ha_connected: boolean }
  | { type: "board"; rev: number; board: Board }
  | { type: "snapshot"; states: Record<string, EntityState> }
  | { type: "state"; entity_id: string; state: EntityState | null }
  | { type: "ha_status"; connected: boolean };

/**
 * WebSocket client for /ws?v=2 with automatic reconnect (04 §4.8).
 * Order on connect: hello, board, snapshot. Before the backend has reached HA
 * only hello arrives; the app shows its waiting screen until a board is there.
 */
export function connectWs(): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let backoff = 1000;
  let reconnectTimer: number | undefined;

  const open = () => {
    if (closed) return;
    ws = new WebSocket(wsUrl("/ws?v=2"));

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
      switch (msg.type) {
        case "hello":
          store.applyHello(msg.version, Boolean(msg.ha_connected));
          break;
        case "board":
          store.applyBoard(msg.board, msg.rev);
          break;
        case "snapshot":
          store.applySnapshot(msg.states || {});
          break;
        case "state":
          store.applyState(msg.entity_id, msg.state);
          break;
        case "ha_status":
          store.setHaConnected(Boolean(msg.connected));
          break;
      }
    };

    ws.onclose = () => {
      useStore.getState().setConnected(false);
      if (closed) return;
      reconnectTimer = window.setTimeout(open, backoff);
      backoff = Math.min(backoff * 2, 15000);
    };

    ws.onerror = () => {
      ws?.close();
    };
  };

  open();

  return () => {
    closed = true;
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    ws?.close();
  };
}
