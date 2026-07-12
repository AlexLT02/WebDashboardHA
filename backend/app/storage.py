"""Dashboard-Layouts als JSON im persistenten /data-Volume.

Bewusst simpel (kein DB): ein iPad-Dashboard-Setup ist klein, und /data
übersteht Add-on-Neustarts. Eine Datei pro Dashboard.
"""

from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path

from .schemas import Dashboard, DashboardCreate, WidgetConfig

log = logging.getLogger("webdashboardha.storage")


class DashboardStore:
    def __init__(self, data_dir: Path) -> None:
        self._dir = data_dir / "dashboards"

    def _ensure_dir(self) -> None:
        self._dir.mkdir(parents=True, exist_ok=True)

    def _path(self, dashboard_id: str) -> Path:
        return self._dir / f"{dashboard_id}.json"

    def init(self) -> None:
        """Legt bei Erststart ein Default-Dashboard an, damit die UI nie leer ist."""
        self._ensure_dir()
        if not any(self._dir.glob("*.json")):
            default = Dashboard(
                id="default",
                name="Wohnzimmer",
                columns=2,
                widgets=[],
            )
            self._write(default)
            log.info("Default-Dashboard angelegt.")

    def list(self) -> list[Dashboard]:
        self._ensure_dir()
        result: list[Dashboard] = []
        for path in sorted(self._dir.glob("*.json")):
            try:
                result.append(Dashboard.model_validate_json(path.read_text("utf-8")))
            except Exception as exc:  # noqa: BLE001
                log.warning("Dashboard %s unlesbar: %s", path.name, exc)
        return result

    def get(self, dashboard_id: str) -> Dashboard | None:
        path = self._path(dashboard_id)
        if not path.exists():
            return None
        return Dashboard.model_validate_json(path.read_text("utf-8"))

    def create(self, payload: DashboardCreate) -> Dashboard:
        self._ensure_dir()
        dashboard = Dashboard(
            id=uuid.uuid4().hex[:12],
            name=payload.name,
            columns=payload.columns,
            widgets=payload.widgets,
        )
        self._write(dashboard)
        return dashboard

    def update(self, dashboard_id: str, payload: DashboardCreate) -> Dashboard | None:
        if not self._path(dashboard_id).exists():
            return None
        dashboard = Dashboard(
            id=dashboard_id,
            name=payload.name,
            columns=payload.columns,
            widgets=payload.widgets,
        )
        self._write(dashboard)
        return dashboard

    def delete(self, dashboard_id: str) -> bool:
        path = self._path(dashboard_id)
        if not path.exists():
            return False
        path.unlink()
        return True

    def _write(self, dashboard: Dashboard) -> None:
        self._ensure_dir()
        # Atomar schreiben: erst temp, dann rename (kein halb-geschriebenes JSON).
        tmp = self._path(dashboard.id).with_suffix(".json.tmp")
        tmp.write_text(dashboard.model_dump_json(indent=2), "utf-8")
        tmp.replace(self._path(dashboard.id))


__all__ = ["DashboardStore", "WidgetConfig"]
