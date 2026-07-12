"""CRUD für Dashboard-Layouts: /api/dashboards."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response, status

from ..dependencies import StoreDep
from ..schemas import Dashboard, DashboardCreate

router = APIRouter(prefix="/api/dashboards", tags=["dashboards"])


@router.get("")
async def list_dashboards(store: StoreDep) -> list[Dashboard]:
    return store.list()


@router.get("/{dashboard_id}")
async def get_dashboard(dashboard_id: str, store: StoreDep) -> Dashboard:
    dashboard = store.get(dashboard_id)
    if dashboard is None:
        raise HTTPException(status_code=404, detail="Dashboard nicht gefunden")
    return dashboard


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_dashboard(payload: DashboardCreate, store: StoreDep) -> Dashboard:
    return store.create(payload)


@router.put("/{dashboard_id}")
async def update_dashboard(
    dashboard_id: str, payload: DashboardCreate, store: StoreDep
) -> Dashboard:
    dashboard = store.update(dashboard_id, payload)
    if dashboard is None:
        raise HTTPException(status_code=404, detail="Dashboard nicht gefunden")
    return dashboard


@router.delete("/{dashboard_id}", response_class=Response)
async def delete_dashboard(dashboard_id: str, store: StoreDep) -> Response:
    if not store.delete(dashboard_id):
        raise HTTPException(status_code=404, detail="Dashboard nicht gefunden")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
