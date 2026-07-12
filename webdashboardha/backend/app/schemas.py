"""Pydantic-Schemas für Requests/Responses."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ServiceCall(BaseModel):
    domain: str = Field(min_length=1, examples=["light"])
    service: str = Field(min_length=1, examples=["turn_on"])
    entity_id: str | list[str] | None = None
    data: dict[str, Any] | None = None


class WidgetConfig(BaseModel):
    id: str
    type: str  # "light" | "sensor" | "switch" | ...
    entity_id: str
    title: str | None = None
    # Position + Größe im Spaltenraster der Gruppe (0-basiert).
    x: int = 0
    y: int = 0
    w: int = 1
    h: int = 1
    # Freie, widget-spezifische Optionen (Farbe erlauben, Icon, ...).
    options: dict[str, Any] = Field(default_factory=dict)


class Group(BaseModel):
    id: str
    name: str = ""  # leer = Gruppe ohne sichtbaren Titel
    columns: int = 4  # feste Spaltenzahl des Rasters
    widgets: list[WidgetConfig] = Field(default_factory=list)


class Dashboard(BaseModel):
    id: str
    name: str
    columns: int = 2
    groups: list[Group] = Field(default_factory=list)


class DashboardCreate(BaseModel):
    name: str = Field(min_length=1)
    columns: int = 2
    groups: list[Group] = Field(default_factory=list)
