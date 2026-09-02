"""Tests for the seed-data loader and GraphRepository (plan Task 1)."""

import json
import shutil
from pathlib import Path

import pytest

from src.data_loader import DataLoadError, GraphRepository, load_all
from src.models import Project, Relationship

DATA_DIR = Path(__file__).resolve().parents[1] / "src" / "data"

EXPECTED_COUNTS = {
    "sources": 9,
    "countries": 5,
    "deposits": 4,
    "organizations": 8,
    "projects": 6,
    "facilities": 4,
    "materials": 13,
    "components": 1,
    "systems": 7,
    "relationships": 16,
}


def test_load_all_returns_expected_counts() -> None:
    data = load_all(DATA_DIR)
    assert {kind: len(records) for kind, records in data.items()} == EXPECTED_COUNTS


def test_load_all_returns_immutable_collections() -> None:
    data = load_all(DATA_DIR)
    assert all(isinstance(records, tuple) for records in data.values())


def test_find_by_id_returns_typed_record() -> None:
    repo = GraphRepository.load(DATA_DIR)
    project = repo.find_by_id("projects", "proj-browns-range")
    assert isinstance(project, Project)
    assert project.name == "Browns Range Heavy Rare Earths Project"


def test_find_by_id_unknown_id_returns_none() -> None:
    repo = GraphRepository.load(DATA_DIR)
    assert repo.find_by_id("projects", "proj-does-not-exist") is None


def test_find_by_id_unknown_kind_returns_none() -> None:
    repo = GraphRepository.load(DATA_DIR)
    assert repo.find_by_id("widgets", "proj-browns-range") is None


def test_find_all_known_kind_returns_records() -> None:
    repo = GraphRepository.load(DATA_DIR)
    relationships = repo.find_all("relationships")
    assert relationships is not None
    assert len(relationships) == EXPECTED_COUNTS["relationships"]
    assert all(isinstance(r, Relationship) for r in relationships)


def test_find_all_unknown_kind_returns_none() -> None:
    repo = GraphRepository.load(DATA_DIR)
    assert repo.find_all("widgets") is None


def test_kinds_lists_every_seed_file() -> None:
    repo = GraphRepository.load(DATA_DIR)
    assert set(repo.kinds) == set(EXPECTED_COUNTS)


def _copy_seed_data(tmp_path: Path) -> Path:
    copy = tmp_path / "data"
    shutil.copytree(DATA_DIR, copy)
    return copy


def test_malformed_record_raises_error_naming_file_and_index(tmp_path: Path) -> None:
    data_dir = _copy_seed_data(tmp_path)
    path = data_dir / "projects.json"
    records = json.loads(path.read_text())
    records[2]["name"] = ""  # require_non_blank must reject this
    path.write_text(json.dumps(records))

    with pytest.raises(DataLoadError, match=r"projects\.json\[2\]"):
        load_all(data_dir)


def test_non_list_file_raises_error_naming_file(tmp_path: Path) -> None:
    data_dir = _copy_seed_data(tmp_path)
    (data_dir / "materials.json").write_text('{"not": "a list"}')

    with pytest.raises(DataLoadError, match=r"materials\.json"):
        load_all(data_dir)


def test_missing_file_raises_error_naming_file(tmp_path: Path) -> None:
    data_dir = _copy_seed_data(tmp_path)
    (data_dir / "systems.json").unlink()

    with pytest.raises(DataLoadError, match=r"systems\.json"):
        load_all(data_dir)
