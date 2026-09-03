"""Shared resource providers for FastAPI dependency injection.

The graph is read-only and built by parsing every seed file, so it is loaded
once at first use and shared. ``lru_cache`` rather than a module-level constant
keeps import side-effect free, which matters because ``scripts/`` imports these
modules outside a running app.
"""

from functools import lru_cache

from scripts.validate_data import build
from src.graph import SupplyGraph


@lru_cache(maxsize=1)
def _graph() -> SupplyGraph:
    return SupplyGraph.from_data(build())


def get_graph() -> SupplyGraph:
    """FastAPI dependency yielding the shared, immutable supply graph."""
    return _graph()
