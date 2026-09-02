"""Shared fixtures for API tests."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.config import get_settings
from src.main import app

DATA_DIR = Path(__file__).resolve().parents[1] / "src" / "data"


@pytest.fixture
def client() -> Iterator[TestClient]:
    get_settings.cache_clear()
    with TestClient(app) as test_client:
        yield test_client
    get_settings.cache_clear()
