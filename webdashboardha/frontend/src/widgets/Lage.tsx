import { Icon } from "../controls/icons";
import { Press } from "../controls/Press";
import { useMinute } from "../state/clock";
import { buildLage, type Lage as LageData, type LageBlock, type LageRow, type LageTap } from "../state/lage";
import { useStore } from "../state/store";
import { useUi } from "../state/ui";

function useOpen(): (tap: LageTap) => void {
  const openPopup = useUi((s) => s.openPopup);
  return (tap) => {
    if (!tap) return;
    if (tap.t === "item") openPopup({ t: "item", id: tap.id });
    else openPopup({ t: tap.t });
  };
}

function Block({ b, onTap }: { b: LageBlock; onTap: () => void }) {
  const hasProgress = b.progress !== undefined && b.progress !== null;
  const inner = (
    <>
      <div className="alert__head">
        <Icon name={b.icon} />
        {b.head}
      </div>
      <div className="alert__big">
        {b.big}
        {b.small ? <small>{b.small}</small> : null}
      </div>
      <div className="alert__sub">{b.sub}</div>
      {hasProgress ? (
        <div className="progress">
          <i style={{ width: `${Math.max(0, Math.min(100, b.progress as number))}%` }} />
        </div>
      ) : null}
    </>
  );
  const cls = `alert alert--${b.tone}${hasProgress ? " has-progress" : ""}`;
  return b.tap ? (
    <Press className={cls} onPress={onTap} label={b.head}>
      {inner}
    </Press>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function Row({ r, onTap }: { r: LageRow; onTap: () => void }) {
  const inner = (
    <>
      <Icon name={r.icon} />
      <span className="row__k">{r.name}</span>
      <span className={`row__v${r.tone ? " " + (r.tone === "warm" ? "on" : r.tone) : ""}`}>
        {r.value}
        {r.muted ? <span>{r.muted}</span> : null}
        {r.chev ? <Icon name="chev" className="chev" /> : null}
      </span>
    </>
  );
  return r.tap ? (
    <Press className="row" onPress={onTap} label={r.name}>
      {inner}
    </Press>
  ) : (
    <div className="row">{inner}</div>
  );
}

/**
 * Lage column (04 §5.4, mockups 01/04): deviations as blocks at the top
 * (red > amber > warm, max 3), the rest as quiet 48 px rows. The selector
 * returns JSON, so the column only re-renders when what it shows changes.
 */
export function Lage() {
  const now = useMinute();
  const key = useStore((s) => (s.board ? JSON.stringify(buildLage(s.board, (id) => s.states[id], now)) : ""));
  const open = useOpen();
  if (!key) return null;
  const lage = JSON.parse(key) as LageData;
  return (
    <section className="lage">
      {lage.blocks.map((b) => (
        <Block key={b.key} b={b} onTap={() => open(b.tap)} />
      ))}
      <div className="rows">
        {lage.rows.map((r) => (
          <Row key={r.key} r={r} onTap={() => open(r.tap)} />
        ))}
      </div>
    </section>
  );
}
