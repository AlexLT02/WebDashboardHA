import { useState } from "react";
import { useEntity } from "../state/store";
import { callService } from "../state/service";
import { useLongPress } from "../controls/useLongPress";
import { MusicIcon } from "../controls/icons";
import { MediaDialog } from "./MediaDialog";
import type { WidgetConfig } from "../state/dashboards";
import "./panels.css";

export function MediaCard({ config }: { config: WidgetConfig }) {
  const entity = useEntity(config.entity_id);
  const [open, setOpen] = useState(false);

  const title =
    (entity?.attributes.media_title as string) ??
    config.title ??
    (entity?.attributes.friendly_name as string) ??
    "Medien";
  const artist = entity?.attributes.media_artist as string | undefined;
  const playing = entity?.state === "playing";
  const big = config.w >= 2 || config.h >= 2;

  const svc = (service: string, data?: Record<string, unknown>) =>
    callService({ domain: "media_player", service, entity_id: config.entity_id, data }).catch(
      console.error,
    );

  const press = useLongPress({
    onTap: () => svc("media_play_pause"),
    onLongPress: () => setOpen(true),
    delay: 500,
  });

  if (!entity) {
    return (
      <div className="panel">
        <div className="media__title">{title}</div>
        <div className="media__artist">nicht verfügbar</div>
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <div className={big ? "media media--big" : "media"} style={{ cursor: "pointer" }} {...press}>
          <span
            className="media__art"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}
          >
            <MusicIcon size={big ? 34 : 22} />
          </span>
          <div className="media__text">
            <div className="media__title">{title}</div>
            {artist && <div className="media__artist">{artist}</div>}
            {!artist && <div className="media__artist">{playing ? "läuft" : "pausiert"}</div>}
          </div>
        </div>

        {big && (
          <div className="media__controls" style={{ marginTop: 8 }}>
            <button className="media__btn" aria-label="zurück" onClick={() => svc("media_previous_track")}>
              ⏮
            </button>
            <button
              className="media__btn"
              aria-label={playing ? "Pause" : "Play"}
              onClick={() => svc("media_play_pause")}
            >
              {playing ? "⏸" : "▶"}
            </button>
            <button className="media__btn" aria-label="weiter" onClick={() => svc("media_next_track")}>
              ⏭
            </button>
          </div>
        )}
      </div>

      {open && (
        <MediaDialog entityId={config.entity_id} title={title} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
