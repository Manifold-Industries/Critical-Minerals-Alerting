"""Read-only access to the loaded seed data (repository pattern)."""

from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from src.data_loader.parse import load_all


@dataclass(frozen=True)
class GraphRepository:
    """Immutable, in-memory store of every seed record, keyed by kind."""

    records: Mapping[str, tuple[object, ...]]

    @classmethod
    def load(cls, data_dir: Path) -> "GraphRepository":
        """Build a repository from the seed files in ``data_dir``.

        Raises :class:`~src.data_loader.parse.DataLoadError` on any bad file.
        """
        return cls(records=load_all(data_dir))

    @property
    def kinds(self) -> frozenset[str]:
        return frozenset(self.records)

    def find_all(self, kind: str) -> tuple[object, ...] | None:
        """All records of ``kind``, or ``None`` for an unknown kind."""
        return self.records.get(kind)

    def find_by_id(self, kind: str, entity_id: str) -> object | None:
        """The record with ``entity_id``, or ``None`` if kind or id is unknown."""
        records = self.records.get(kind, ())
        return next((r for r in records if getattr(r, "id", None) == entity_id), None)
