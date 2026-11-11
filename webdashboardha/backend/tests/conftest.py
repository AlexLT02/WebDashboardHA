"""Shared fixtures: real HA snapshot (read-only, 2026-11-11) and fakes."""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

import pytest

from app.registry import Registry
from app.zones import ZoneStore, load_seed

FIXTURES = Path(__file__).resolve().parent / "fixtures"
# Fixed "now", a few minutes after the newest last_changed in states.json.
FIXTURE_NOW = 1794400800.0


def load_registry_lists() -> dict[str, list[dict[str, Any]]]:
    raw = json.loads((FIXTURES / "registry.json").read_text("utf-8"))
    return {k: raw[k] for k in ("areas", "devices", "entities", "labels")}


def load_states() -> dict[str, dict[str, Any]]:
    return {s["entity_id"]: s for s in json.loads((FIXTURES / "states.json").read_text("utf-8"))}


@pytest.fixture
def reg_lists() -> dict[str, list[dict[str, Any]]]:
    return load_registry_lists()


@pytest.fixture
def registry(reg_lists) -> Registry:
    return Registry.from_lists(**copy.deepcopy(reg_lists))


@pytest.fixture
def states() -> dict[str, dict[str, Any]]:
    return load_states()


@pytest.fixture
def seed() -> dict[str, Any]:
    return load_seed()


@pytest.fixture
def store(tmp_path, seed) -> ZoneStore:
    s = ZoneStore(tmp_path / "zones.json", seed, now=lambda: FIXTURE_NOW)
    s.load()
    return s


class FakeHA:
    """Stands in for HAClient: records service calls, serves registry lists."""

    def __init__(self, ws_url: str, token: str, **callbacks: Any) -> None:
        self.cb = callbacks
        self.connected = False
        self.calls: list[tuple[str, str, Any, Any]] = []
        self.commands: list[dict[str, Any]] = []
        self.subscriptions: list[str] = []
        self.registry_lists: dict[str, list[dict[str, Any]]] = {}
        self.fail_services: set[str] = set()

    def start(self) -> None:  # no network
        pass

    async def stop(self) -> None:
        pass

    async def send_command(self, payload: dict[str, Any]) -> dict[str, Any]:
        self.commands.append(payload)
        key = {
            "config/area_registry/list": "areas",
            "config/device_registry/list": "devices",
            "config/entity_registry/list": "entities",
            "config/label_registry/list": "labels",
        }[payload["type"]]
        return {"success": True, "result": copy.deepcopy(self.registry_lists.get(key, []))}

    async def subscribe_events(self, event_type: str) -> None:
        self.subscriptions.append(event_type)

    async def call_service(self, domain, service, *, entity_id=None, service_data=None,
                           return_response=False):
        if f"{domain}.{service}" in self.fail_services:
            raise RuntimeError("HA-Kommando fehlgeschlagen")
        self.calls.append((domain, service, entity_id, service_data))
        return {"success": True}

    async def connect(self, registry_lists, states) -> None:
        """Replay the real connect order: auth -> registry -> states."""
        self.registry_lists = registry_lists
        self.connected = True
        await self.cb["on_authenticated"]()
        await self.cb["on_connected"](copy.deepcopy(states))

    async def disconnect(self) -> None:
        self.connected = False
        await self.cb["on_disconnected"]()
