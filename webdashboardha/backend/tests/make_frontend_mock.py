"""Write frontend/mock/board.json + states.json from seed + fixture registry.

    cd backend && .venv/Scripts/python tests/make_frontend_mock.py

board.json = GET /api/board, states.json = the v2 snapshot (watch-set only).
"""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))

from app.board import build_board, slim_state  # noqa: E402
from app.registry import Registry  # noqa: E402
from app.zones import ZoneStore, load_seed  # noqa: E402
from conftest import FIXTURE_NOW, load_registry_lists, load_states  # noqa: E402

OUT = HERE.parents[1] / "frontend" / "mock"


def main() -> None:
    registry = Registry.from_lists(**load_registry_lists())
    states = load_states()
    with tempfile.TemporaryDirectory() as tmp:
        store = ZoneStore(Path(tmp) / "zones.json", load_seed(), now=lambda: FIXTURE_NOW)
        store.load()
        board = build_board(store.seed, store, registry, states, FIXTURE_NOW)
    snapshot = {eid: slim_state(states[eid]) for eid in sorted(board.watch) if eid in states}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "board.json").write_text(
        json.dumps({"rev": 1, "generated_now": int(FIXTURE_NOW), **board.data}, ensure_ascii=False, indent=1),
        "utf-8",
    )
    (OUT / "states.json").write_text(json.dumps(snapshot, ensure_ascii=False, indent=1), "utf-8")
    print(f"board.json: {len(board.data['items'])} items, watch {len(board.watch)}; "
          f"states.json: {len(snapshot)} states -> {OUT}")


if __name__ == "__main__":
    main()
