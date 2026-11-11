import { useUi } from "../state/ui";
import { useBoard } from "../state/store";
import { LightPopup } from "./popups/LightPopup";
import { SwitchPopup } from "./popups/SwitchPopup";
import { GroupPopup } from "./popups/GroupPopup";
import { CoverPopup } from "./popups/CoverPopup";
import { InfoPopup } from "./popups/InfoPopup";
import { ServicePanel } from "../shell/ServicePanel";
import { SettingsDialog } from "./SettingsDialog";
import type { Item } from "../state/model";

/** Popup per item kind (04 §5.3 column "Popup"). */
export function ItemPopup({ item, name }: { item: Item; name?: string }) {
  switch (item.kind) {
    case "light":
    case "status_led":
      return <LightPopup item={item} name={name} />;
    case "light_onoff":
    case "switch":
    case "switch_critical":
    case "input_boolean":
      return <SwitchPopup item={item} name={name} />;
    case "group":
    case "switch_group":
      return <GroupPopup item={item} name={name} />;
    case "cover":
    case "cover_pos":
      return <CoverPopup item={item} name={name} />;
    default:
      return <InfoPopup item={item} name={name} />;
  }
}

/** The one popup slot; closed popups are unmounted (04 §5.1 DOM budget). */
export function PopupHost() {
  const popup = useUi((s) => s.popup);
  const board = useBoard();
  if (!popup || !board) return null;
  switch (popup.t) {
    case "item": {
      const item = board.items[popup.id];
      return item ? <ItemPopup key={popup.id} item={item} name={popup.name} /> : null;
    }
    case "service":
      return <ServicePanel />;
    case "settings":
      return <SettingsDialog />;
    default:
      return null;
  }
}
