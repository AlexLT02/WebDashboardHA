"""Gemeinsame FastAPI-Dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request

from .hub import Hub
from .storage import DashboardStore


def get_hub(request: Request) -> Hub:
    return request.app.state.hub


def get_store(request: Request) -> DashboardStore:
    return request.app.state.store


HubDep = Annotated[Hub, Depends(get_hub)]
StoreDep = Annotated[DashboardStore, Depends(get_store)]
