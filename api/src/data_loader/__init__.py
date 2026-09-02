"""Seed-data loading: JSON files -> frozen dataclass records.

Single home for the seed-file wire format, shared by the API and
``scripts/validate_data.py`` so the two cannot drift.
"""

from src.data_loader.parse import DataLoadError, load_all
from src.data_loader.repository import GraphRepository

__all__ = ["DataLoadError", "GraphRepository", "load_all"]
