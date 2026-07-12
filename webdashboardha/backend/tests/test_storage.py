"""Tests für DashboardStore: Migration alter Layouts + CRUD."""

from __future__ import annotations

import json
from pathlib import Path

from app.schemas import DashboardCreate, Group, WidgetConfig
from app.storage import DashboardStore


def _store(tmp_path: Path) -> DashboardStore:
    return DashboardStore(tmp_path)


def test_init_creates_default(tmp_path: Path) -> None:
    s = _store(tmp_path)
    s.init()
    dashboards = s.list()
    assert len(dashboards) == 1
    assert dashboards[0].groups  # eine Default-Gruppe
    assert dashboards[0].groups[0].columns == 4


def test_migrates_flat_widgets_to_grid(tmp_path: Path) -> None:
    """Altes Format (flache widgets-Liste, ohne x/y) -> Gruppen + Rasterpositionen."""
    d = tmp_path / "dashboards"
    d.mkdir(parents=True)
    (d / "old.json").write_text(
        json.dumps(
            {
                "id": "old",
                "name": "Alt",
                "columns": 2,
                "widgets": [
                    {"id": "w1", "type": "light", "entity_id": "light.a"},
                    {"id": "w2", "type": "light", "entity_id": "light.b"},
                    {"id": "w3", "type": "light", "entity_id": "light.c"},
                ],
            }
        ),
        "utf-8",
    )
    s = _store(tmp_path)
    dash = s.get("old")
    assert dash is not None
    assert len(dash.groups) == 1
    g = dash.groups[0]
    # 4-Spalten-Default -> zeilenweise Layout
    positions = {w.id: (w.x, w.y) for w in g.widgets}
    assert positions == {"w1": (0, 0), "w2": (1, 0), "w3": (2, 0)}


def test_crud_roundtrip_with_grid(tmp_path: Path) -> None:
    s = _store(tmp_path)
    s.init()
    created = s.create(
        DashboardCreate(
            name="Neu",
            columns=2,
            groups=[
                Group(
                    id="g1",
                    name="Test",
                    columns=3,
                    widgets=[
                        WidgetConfig(
                            id="w1", type="light", entity_id="light.x", x=2, y=1, w=1, h=1
                        )
                    ],
                )
            ],
        )
    )
    assert created.id
    got = s.get(created.id)
    assert got is not None
    assert got.groups[0].columns == 3
    assert (got.groups[0].widgets[0].x, got.groups[0].widgets[0].y) == (2, 1)

    # Update
    updated = s.update(
        created.id,
        DashboardCreate(name="Umbenannt", columns=2, groups=[Group(id="g1", name="", columns=4)]),
    )
    assert updated is not None
    assert updated.name == "Umbenannt"
    assert updated.groups[0].widgets == []

    # Delete
    assert s.delete(created.id) is True
    assert s.get(created.id) is None
