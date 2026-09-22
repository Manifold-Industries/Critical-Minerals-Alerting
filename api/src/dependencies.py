"""Shared resource providers for FastAPI dependency injection.

The graph is read-only and built by parsing every seed file, so it is loaded
once at first use and shared. ``lru_cache`` rather than a module-level constant
keeps import side-effect free, which matters because ``scripts/`` imports these
modules outside a running app.

The OSINT corpus is provided separately rather than hung off the graph. It is a
snapshot of an external feed with its own cadence and its own ranking labels,
and the join between the two is a node id and nothing else - see
``src/osint/corpus.py`` for why that separation is load-bearing.
"""

from functools import lru_cache

from scripts.validate_data import build
from src.graph import SupplyGraph
from src.osint import Corpus, load_corpus


@lru_cache(maxsize=1)
def _graph() -> SupplyGraph:
    return SupplyGraph.from_data(build())


def get_graph() -> SupplyGraph:
    """FastAPI dependency yielding the shared, immutable supply graph."""
    return _graph()


def get_osint_corpus() -> Corpus:
    """FastAPI dependency yielding the parsed OSINT corpus.

    ``load_corpus`` caches, so this is a dict lookup after the first call. It
    raises ``CorpusError`` on a malformed file rather than serving half of it.
    """
    return load_corpus()
