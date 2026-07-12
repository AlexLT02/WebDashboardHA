"""Laufzeit-Konfiguration aus Umgebungsvariablen.

Zwei Betriebsmodi:
- **Add-on (HA OS):** SUPERVISOR_TOKEN ist gesetzt, HA erreichbar über
  http://supervisor/core. Kein manuelles Token nötig.
- **Lokale Entwicklung:** HA_URL + HA_TOKEN (Long-Lived-Token) aus .env.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _load_dotenv() -> None:
    """Lädt backend/.env in os.environ (nur für lokale Entwicklung).

    Minimaler Parser statt python-dotenv-Dependency. Setzt Werte nur, wenn sie
    nicht ohnehin schon in der Umgebung stehen (echte Env gewinnt).
    """
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


@dataclass(frozen=True)
class Settings:
    ha_base_url: str
    ha_token: str
    static_dir: Path
    data_dir: Path
    port: int

    @property
    def ha_ws_url(self) -> str:
        # http(s)://host  ->  ws(s)://host/api/websocket
        base = self.ha_base_url.rstrip("/")
        ws = base.replace("https://", "wss://").replace("http://", "ws://")
        return f"{ws}/api/websocket"

    @property
    def ha_rest_url(self) -> str:
        return f"{self.ha_base_url.rstrip('/')}/api"


def load_settings() -> Settings:
    _load_dotenv()
    supervisor_token = os.environ.get("SUPERVISOR_TOKEN")

    if supervisor_token:
        # Add-on-Modus: fester interner Supervisor-Proxy zum HA-Core.
        ha_base_url = "http://supervisor/core"
        ha_token = supervisor_token
    else:
        # Dev-Modus: explizite HA-Adresse + Long-Lived-Token.
        ha_base_url = os.environ.get("HA_URL", "http://localhost:8123")
        ha_token = os.environ.get("HA_TOKEN", "")

    # Frontend-Build liegt neben dem Backend im Container unter /app/static;
    # lokal relativ zum Repo (frontend/dist).
    static_env = os.environ.get("STATIC_DIR")
    if static_env:
        static_dir = Path(static_env)
    else:
        static_dir = Path(__file__).resolve().parents[2] / "frontend" / "dist"

    # Add-on: /data (persistentes Volume). Dev: repo-lokales ./data.
    data_env = os.environ.get("DATA_DIR")
    if data_env:
        data_dir = Path(data_env)
    elif supervisor_token:
        data_dir = Path("/data")
    else:
        data_dir = Path(__file__).resolve().parents[2] / "data"
    port = int(os.environ.get("PORT", "8099"))

    return Settings(
        ha_base_url=ha_base_url,
        ha_token=ha_token,
        static_dir=static_dir,
        data_dir=data_dir,
        port=port,
    )
