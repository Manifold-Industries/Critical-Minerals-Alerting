"""Round-trip tests: encode(parse(record)) == record for every seed record."""

import json
from pathlib import Path

from src.data_loader import load_all
from src.serialization import encode

DATA_DIR = Path(__file__).resolve().parents[1] / "src" / "data"


def test_encode_round_trips_every_seed_record() -> None:
    data = load_all(DATA_DIR)
    for kind, records in data.items():
        raw = json.loads((DATA_DIR / f"{kind}.json").read_text())
        for record, original in zip(records, raw, strict=True):
            assert encode(record) == original, f"{kind}: {original['id']} does not round-trip"
