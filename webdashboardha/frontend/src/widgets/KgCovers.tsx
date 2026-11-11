import { Icon } from "../controls/icons";
import { useTap } from "../controls/useTap";
import { coversSummary } from "../state/cover";
import { useStore } from "../state/store";
import { useUi } from "../state/ui";
import { CoverButtons } from "./CoverWide";
import type { KgCovers as KgCoversCfg } from "../state/model";

/**
 * K&G Rollläden 376 x 72 (03 §3): ▲ ■ ▼ act on both covers at once, the area
 * opens "Alle Rollläden". The status shows the last command ("beide ▲ 07:30"),
 * because the covers only report an estimated state (02 B6).
 */
export function KgCovers({ kg }: { kg: KgCoversCfg }) {
  const ids = kg.covers.map((c) => c.id);
  const status = useStore((s) => coversSummary(kg.covers.map((c) => ({ short: c.short, st: s.states[c.id] }))));
  const moving = useStore((s) => {
    for (const id of ids) {
      const st = s.states[id]?.state;
      if (st === "opening" || st === "closing") return st;
    }
    return "";
  });
  const openPopup = useUi((s) => s.openPopup);
  const open = () => openPopup({ t: "covers" });
  const ref = useTap({ onTap: open, onLongPress: open });
  return (
    <div ref={ref} className="tile tile--cover span2" data-id="kg.covers">
      <div className="badge badge--bare">
        <Icon name="blinds" />
      </div>
      <div className="tile__t">
        <div className="tile__name">{kg.name}</div>
        <div className="tile__sub">{status}</div>
      </div>
      <CoverButtons ids={ids} moving={moving} label={kg.name} />
    </div>
  );
}
