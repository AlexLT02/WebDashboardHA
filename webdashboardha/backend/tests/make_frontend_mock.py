"""Write frontend/mock/board.json + states.json + hints.json from seed + fixture registry.

    cd backend && .venv/Scripts/python tests/make_frontend_mock.py

board.json = GET /api/board, states.json = the v2 snapshot (watch-set only),
hints.json = registry knowledge the frontend mock cannot derive on its own
(which items ``script.alles_aus`` reaches).
"""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))

from app.actions import ActionService  # noqa: E402
from app.board import build_board, slim_state  # noqa: E402
from app.registry import Registry  # noqa: E402
from app.zones import ZoneStore, load_seed  # noqa: E402
from conftest import FIXTURE_NOW, load_registry_lists, load_states  # noqa: E402

OUT = HERE.parents[1] / "frontend" / "mock"


async def _noop(*_args: object) -> None:
    return None


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

    # With everything "on", the alles_aus target set is exactly what the script covers.
    all_on = {eid: {**st, "state": "on"} for eid, st in states.items()}
    covered, _label = ActionService(_noop).off_targets("alles_aus", None, board.data, all_on, registry)
    (OUT / "hints.json").write_text(
        json.dumps({"alles_aus_covered": covered}, ensure_ascii=False, indent=1), "utf-8"
    )
    print(f"board.json: {len(board.data['items'])} items, watch {len(board.watch)}; "
          f"states.json: {len(snapshot)} states; hints.json: {len(covered)} alles_aus targets -> {OUT}")


if __name__ == "__main__":
    main()
