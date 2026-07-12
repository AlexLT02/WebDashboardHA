import { useEntity } from "../state/store";
import { callService } from "../state/service";
import "./MoreInfoDialog.css";
import "./panels.css";

interface Props {
  entityId: string;
  title: string;
  onClose: () => void;
}

/** Media-Dialog (Halten auf einer Media/Spotify-Kachel): Wiedergabe steuern,
 *  Lautstärke, und Quelle/Playlist aus source_list wählen. */
export function MediaDialog({ entityId, title, onClose }: Props) {
  const entity = useEntity(entityId);
  const playing = entity?.state === "playing";
  const artist = entity?.attributes.media_artist as string | undefined;
  const sources = (entity?.attributes.source_list as string[] | undefined) ?? [];
  const current = entity?.attributes.source as string | undefined;

  const svc = (service: string, data?: Record<string, unknown>) =>
    callService({ domain: "media_player", service, entity_id: entityId, data }).catch(console.error);

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__header">
          <button type="button" className="dialog__close" aria-label="Schließen" onClick={onClose}>
            ✕
          </button>
          <h2 className="dialog__title">{title}</h2>
          <span />
        </div>

        {artist && <div className="media__artist">{artist}</div>}

        <div className="media__controls">
          <button className="media__btn" aria-label="zurück" onClick={() => svc("media_previous_track")}>
            ⏮
          </button>
          <button
            className="media__btn"
            style={{ width: 60, height: 60, fontSize: 22 }}
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => svc("media_play_pause")}
          >
            {playing ? "⏸" : "▶"}
          </button>
          <button className="media__btn" aria-label="weiter" onClick={() => svc("media_next_track")}>
            ⏭
          </button>
        </div>

        <div className="media__controls">
          <span className="media__artist">Lautstärke</span>
          <button className="media__btn" aria-label="leiser" onClick={() => svc("volume_down")}>
            −
          </button>
          <button className="media__btn" aria-label="lauter" onClick={() => svc("volume_up")}>
            +
          </button>
        </div>

        {sources.length > 0 && (
          <div className="media__sources">
            <div className="media__artist" style={{ marginBottom: 4 }}>
              Quelle / Playlist
            </div>
            {sources.map((s) => (
              <button
                key={s}
                type="button"
                className={`media__source${s === current ? " is-active" : ""}`}
                onClick={() => svc("select_source", { source: s })}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
