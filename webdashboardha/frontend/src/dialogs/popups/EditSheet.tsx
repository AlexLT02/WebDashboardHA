import { useEffect, useState } from "react";
import { Dialog } from "../Dialog";
import { Icon } from "../../controls/icons";
import { Press } from "../../controls/Press";
import { ApiError, patchItem, putFavorites, resetItem } from "../../state/api";
import { moveFavorite, orderPeers, stufeChange, stufeOf, stufeOptions, validName, zoneNameOf, type Stufe } from "../../state/alle";
import { shortName } from "../../state/format";
import { useBoard } from "../../state/store";
import type { Board } from "../../state/model";

const NAME_MAX = 14;

function stufeLabel(s: Stufe, system: boolean): string {
  if (s === "start") return "Start";
  if (s === "zone") return system ? "Nicht auf Start" : "Zone";
  if (s === "all") return "Nur Alle";
  return "Ausblenden";
}

/**
 * Bearbeiten-Blatt (04 §5.7): tier as a segment ★ Start · Zone · Nur Alle ·
 * Ausblenden, name (max 14, counter), zone (5 + keine), order ◀ ▶ in the
 * section or the favourites, reset. Every change goes to the add-on
 * (zones.json) and comes back as a new board over the WebSocket.
 */
export function EditSheet({ id, from }: { id: string; from: "fav" | "zone" }) {
  const board = useBoard() as Board;
  const item = board.items[id];
  const fav = board.start.favorites.filter((f) => f.id === id)[0];
  const favCtx = from === "fav" && !!fav;
  const current = item ? (favCtx ? fav.name : item.name_auto ? shortName(item.name) : item.name) : "";
  const [name, setName] = useState(current);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!dirty) setName(current);
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!item) return null;

  const run = (job: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    job().then(
      () => setBusy(false),
      (e) => {
        setBusy(false);
        setMsg(e instanceof ApiError && e.status === 422 ? "Abgelehnt, ungültiger Wert" : "Fehlgeschlagen, nichts geändert");
      },
    );
  };
  const favIds = board.start.favorites.map((f) => f.id);
  const stufe = stufeOf(board, item);
  const opts = stufeOptions(item);
  const setStufe = (want: Stufe) => {
    if (want === stufe) return;
    const c = stufeChange(board, item, want);
    if (c.error) {
      setMsg(c.error);
      return;
    }
    run(async () => {
      if (c.favorites) await putFavorites(c.favorites);
      if (c.patch) await patchItem(id, c.patch);
    });
  };
  const valid = validName(name);
  const commitName = () => {
    if (!valid) {
      setMsg(`Name 1 bis ${NAME_MAX} Zeichen`);
      return;
    }
    if (valid === current) {
      setDirty(false);
      return;
    }
    run(async () => {
      if (favCtx) await putFavorites(favIds, { [id]: valid });
      else await patchItem(id, { name: valid });
      setDirty(false);
    });
  };
  const peers = orderPeers(board, id, favCtx ? "fav" : "zone");
  const idx = peers.indexOf(id);
  const move = (step: -1 | 1) =>
    run(() => (favCtx ? putFavorites(moveFavorite(favIds, id, step)) : patchItem(id, { order_step: step })));
  const where = favCtx ? "Start" : item.zone ? zoneNameOf(board, item.zone) : item.system ? "Systemplatz" : "ohne Zone";

  return (
    <Dialog
      name={current || item.name}
      state={`Bearbeiten, ${where}`}
      badge={{ icon: item.icon, on: false }}
      foot={msg || (busy ? "Speichert …" : "Nur im Add-on gespeichert, Home Assistant bleibt unverändert")}
    >
      <div className="psub">Stufe</div>
      <div className={`seg seg--${opts.length}`}>
        {opts.map((o) => (
          <Press key={o} className={stufe === o ? "is-sel" : ""} label={`Stufe ${stufeLabel(o, !!item.system)}`} onPress={() => setStufe(o)}>
            {o === "start" ? <Icon name="star" /> : null}
            {stufeLabel(o, !!item.system)}
          </Press>
        ))}
      </div>
      <div className="psub">
        Name<span>{favCtx ? "auf dem Start" : item.chip ? "der Gruppe" : "der Kachel"}</span>
      </div>
      <div className="ename">
        <input
          type="text"
          className={`ename__in${dirty && !valid ? " is-bad" : ""}`}
          value={name}
          maxLength={NAME_MAX}
          spellCheck={false}
          autoCorrect="off"
          aria-label="Name"
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
            setMsg(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
              commitName();
            }
          }}
        />
        <span className="ename__n">{`${name.length}/${NAME_MAX}`}</span>
        <Press className={`pbtn${dirty && valid ? " pbtn--cool" : " is-disabled"}`} disabled={!dirty || !valid} label="Name übernehmen" onPress={commitName}>
          Übernehmen
        </Press>
      </div>
      {!item.system ? (
        <>
          <div className="psub">Zone</div>
          <div className="qchips qchips--3">
            {board.zones.map((z) => (
              <Press key={z.id} className={`qchip${item.zone === z.id ? " is-sel" : ""}`} label={`Zone ${z.name}`} onPress={() => item.zone !== z.id && run(() => patchItem(id, { zone: z.id }))}>
                {z.name}
              </Press>
            ))}
            <Press className={`qchip${!item.zone ? " is-sel" : ""}`} label="Keine Zone" onPress={() => item.zone && run(() => patchItem(id, { zone: null }))}>
              keine
            </Press>
          </div>
        </>
      ) : null}
      <div className="psub">
        Reihenfolge<span>{favCtx ? "in den Favoriten" : "im Abschnitt"}</span>
      </div>
      <div className="qchips qchips--2">
        <Press className={`qchip${idx > 0 ? "" : " is-disabled"}`} disabled={idx <= 0} label="Nach vorn" onPress={() => move(-1)}>
          <Icon name="left" size={18} className="qicon" />
          früher
        </Press>
        <Press className={`qchip${idx !== -1 && idx < peers.length - 1 ? "" : " is-disabled"}`} disabled={idx === -1 || idx >= peers.length - 1} label="Nach hinten" onPress={() => move(1)}>
          später
          <Icon name="right" size={18} className="qicon" />
        </Press>
      </div>
      <Press className="pbtn" label="Zurücksetzen" onPress={() => run(() => resetItem(id))}>
        Zurücksetzen
      </Press>
    </Dialog>
  );
}
