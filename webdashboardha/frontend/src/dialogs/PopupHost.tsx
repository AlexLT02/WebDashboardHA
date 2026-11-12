import { useUi } from "../state/ui";
import { useBoard } from "../state/store";
import { LightPopup } from "./popups/LightPopup";
import { SwitchPopup } from "./popups/SwitchPopup";
import { GroupPopup } from "./popups/GroupPopup";
import { CoverPopup } from "./popups/CoverPopup";
import { HeatingPopup, SimpleClimatePopup } from "./popups/ClimatePopup";
import { MediaPopup, TvPopup } from "./popups/MediaPopup";
import { MusicPopup } from "./popups/MusicPopup";
import { VacuumPopup } from "./popups/VacuumPopup";
import { AppliancePopup } from "./popups/AppliancePopup";
import { ActivePopup, ContactsPopup, CoversPopup, KgPopup } from "./popups/StartPopups";
import { EditSheet } from "./popups/EditSheet";
import { OrphansPopup, ServicePanel } from "../shell/ServicePanel";
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
    case "climate_tuya":
      return <HeatingPopup item={item} name={name} />;
    case "climate":
      return <SimpleClimatePopup item={item} name={name} />;
    case "tv":
      return <TvPopup item={item} name={name} />;
    case "media":
      return <MediaPopup item={item} name={name} />;
    case "music_room":
    case "multiroom":
      return <MusicPopup item={item} name={name} />;
    case "appliance":
      return <AppliancePopup item={item} name={name} />;
    case "vacuum":
      return <VacuumPopup entityId={item.id} />;
  }
  return null;
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
    case "kg":
      return <KgPopup key={popup.id || popup.role} role={popup.role} id={popup.id} />;
    case "covers":
      return <CoversPopup />;
    case "contacts":
      return <ContactsPopup />;
    case "active":
      return <ActivePopup />;
    case "vacuum":
      return <VacuumPopup entityId={popup.id} />;
    case "service":
      return <ServicePanel />;
    case "orphans":
      return <OrphansPopup />;
    case "settings":
      return <SettingsDialog />;
    case "edit":
      return board.items[popup.id] ? <EditSheet key={`${popup.id}|${popup.from}`} id={popup.id} from={popup.from} /> : null;
    default:
      return null;
  }
}
