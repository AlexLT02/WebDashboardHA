/**
 * What a tap does, per item kind (04 §5.3). Every command goes out with an
 * optimistic record (pending.ts); bulk "off" goes through /api/actions/off and
 * yields an undo token for the top notice.
 */
import { actionOff, actionOn, callService, type OffResult, type OffScope, type ServiceCall } from "./api";
import { beginPending, failPending } from "./pending";
import { showOffResult, showText } from "./notice";
import { useStore } from "./store";
import type { Item } from "./model";
import type { TileView } from "./tileState";

export function domainOf(entityId: string): string {
  return entityId.split(".")[0];
}

/** Run a single service call for an item with optimistic feedback. */
function send(item: Item, on: boolean, calls: ServiceCall[], script = false): void {
  const board = useStore.getState().board;
  beginPending(item, on, board, script);
  calls
    .reduce<Promise<unknown>>((p, c) => p.then(() => callService(c)), Promise.resolve())
    .catch(() => failPending(item.id));
}

/** Bulk "off" with undo, used by groups, zones, Ambiente, Alles aus, all lights. */
export function runOff(scope: OffScope, item?: Item): Promise<OffResult | null> {
  if (item) beginPending(item, false, useStore.getState().board);
  return actionOff(scope).then(
    (res) => {
      showOffResult(scope, res);
      return res;
    },
    () => {
      if (item) failPending(item.id);
      showText("Fehlgeschlagen, nichts geschaltet", "amber");
      return null;
    },
  );
}

function runOn(item: Item, scope: Parameters<typeof actionOn>[0]): void {
  beginPending(item, true, useStore.getState().board);
  actionOn(scope).catch(() => failPending(item.id));
}

/** Icon tap on a tile with a switchable badge. */
export function toggleItem(item: Item, view: TileView): void {
  const id = item.id;
  const want = !view.on;
  switch (item.kind) {
    case "group":
    case "switch_group":
      if (view.on) runOff({ scope: "group", id }, item);
      else runOn(item, { scope: "group", id });
      return;
    case "light":
    case "light_onoff":
    case "status_led":
      send(item, want, [{ domain: "light", service: want ? "turn_on" : "turn_off", entity_id: id }]);
      return;
    case "switch":
    case "switch_critical":
    case "input_boolean":
    case "multiroom":
      send(item, want, [{ domain: domainOf(id), service: want ? "turn_on" : "turn_off", entity_id: id }]);
      return;
    case "tv": {
      if (!item.primary) return;
      if (want) send(item, true, [{ domain: "media_player", service: "turn_on", entity_id: item.primary }], true);
      else {
        const ids = item.tv ? [item.primary, item.tv] : [item.primary];
        send(item, false, [{ domain: "media_player", service: "turn_off", entity_id: ids }], true);
      }
      return;
    }
    case "media":
      send(item, want, [{ domain: "media_player", service: want ? "turn_on" : "turn_off", entity_id: id }]);
      return;
    case "music_room":
      // Badge = mute toggle; never send `muted` together with a volume (02 §4).
      send(item, want, [
        { domain: "media_player", service: "volume_mute", entity_id: id, data: { is_volume_muted: !want } },
      ]);
      return;
  }
}

/** Plain fire-and-forget service call (cover buttons, popup controls). */
export function fire(call: ServiceCall, onError?: () => void): void {
  callService(call).catch(() => {
    if (onError) onError();
    else showText("Fehlgeschlagen", "amber");
  });
}
