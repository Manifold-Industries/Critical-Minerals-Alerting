"""Integration tests for GET /{kind}/{id} and startup behaviour."""

import json
import shutil
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.config import get_settings
from src.data_loader import DataLoadError
from src.main import app

DATA_DIR = Path(__file__).resolve().parents[1] / "src" / "data"


@pytest.fixture
def client() -> Iterator[TestClient]:
    get_settings.cache_clear()
    with TestClient(app) as test_client:
        yield test_client
    get_settings.cache_clear()


def test_get_entity_returns_success_envelope_with_nested_fields(client: TestClient) -> None:
    body = client.get("/facilities/fac-eneabba").json()
    assert body == {"success": True, "data": body["data"], "error": None}
    assert body["data"]["capacities"][0]["value"]["tonnes_per_year"] == 16000
    assert body["data"]["operating_status"]["provenance"]["type"] == "REPORTED"


def test_unknown_kind_and_unknown_id_return_404_envelopes(client: TestClient) -> None:
    for path, expected_in_error in [
        ("/widgets/anything", "widgets"),
        ("/projects/proj-does-not-exist", "proj-does-not-exist"),
    ]:
        response = client.get(path)
        assert response.status_code == 404
        body = response.json()
        assert body["success"] is False
        assert body["data"] is None
        assert expected_in_error in body["error"]


def test_startup_fails_loudly_on_corrupt_seed_data(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    corrupt_dir = tmp_path / "data"
    shutil.copytree(DATA_DIR, corrupt_dir)
    path = corrupt_dir / "projects.json"
    records = json.loads(path.read_text())
    records[0]["country_id"] = ""
    path.write_text(json.dumps(records))

    monkeypatch.setenv("API_DATA_DIR", str(corrupt_dir))
    get_settings.cache_clear()
    try:
        with pytest.raises(DataLoadError, match=r"projects\.json"):
            with TestClient(app):
                pass
    finally:
        get_settings.cache_clear()
