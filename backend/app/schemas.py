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
    # Freie, widget-spezifische Optionen (Farbe erlauben, Icon, ...).
    options: dict[str, Any] = Field(default_factory=dict)


class Dashboard(BaseModel):
    id: str
    name: str
    # Grid-Layout: einfache Spaltenzahl + Widgets in Reihenfolge (MVP).
    columns: int = 2
    widgets: list[WidgetConfig] = Field(default_factory=list)


class DashboardCreate(BaseModel):
    name: str = Field(min_length=1)
    columns: int = 2
    widgets: list[WidgetConfig] = Field(default_factory=list)
