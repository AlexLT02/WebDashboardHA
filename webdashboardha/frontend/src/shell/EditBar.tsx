import { Icon } from "../controls/icons";
import { Press } from "../controls/Press";
import { useUi } from "../state/ui";

/**
 * Blue bar "Bearbeiten · Fertig" (04 §5.7) in the top notice slot. While it
 * shows, taps open the edit sheet, nothing switches; the return to Start is
 * paused and the mode ends by itself after 10 min (ui.ts).
 */
export function EditBar() {
  const editing = useUi((s) => s.editing);
  const end = useUi((s) => s.endEdit);
  if (!editing) return null;
  return (
    <div className="editbar" role="status">
      <Icon name="pencil" />
      <div className="editbar__txt">
        Bearbeiten<span>Kachel antippen</span>
      </div>
      <Press className="editbar__btn" label="Bearbeiten beenden" onPress={end}>
        Fertig
      </Press>
    </div>
  );
}
