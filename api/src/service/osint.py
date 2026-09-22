"""Maps the OSINT corpus onto the generic per-node contract, and ranks it.

This module is the seam. Everything above it - the router, the schemas, the
console - is written against ``NodeOSINT`` and knows nothing about where the
rows came from. Everything below it is one curated file today. Replacing that
file with a collection pipeline means rewriting ``_development`` and nothing
else, which is the whole point of keeping the corpus shape out of the schemas.

Ranking is done here rather than in the client for the same reason: the order
is a product of how the developments were produced, and the client is
deliberately not told.
"""

from datetime import date
from typing import Protocol, TypeVar

from src.osint import Article, Corpus
from src.schemas import osint as schemas

#: Order of the labels this corpus uses. A label outside it ranks *below*
#: LOW rather than above VERY_HIGH: an unrecognised priority is an unknown
#: quantity, and floating it to the top of the list would make introducing a
#: new label in a new domain a silent promotion.
PRIORITY_RANK: dict[str, int] = {
    "VERY_HIGH": 4,
    "HIGH": 3,
    "MEDIUM": 2,
    "LOW": 1,
}


class Ranked(Protocol):
    """The four fields the ordering reads. Anything carrying them can be ranked."""

    id: str
    priority: str | None
    relevance_score: float | None
    published_at: date | None


R = TypeVar("R", bound=Ranked)


def rank_developments(developments: list[R]) -> list[R]:
    """Best first: priority, then relevance, then recency, then id.

    Priority leads because it is the label a reader acts on, and a fractionally
    better score must not let a HIGH row overtake a VERY_HIGH one. Recency is
    third, not first: Serra Verde's closing matters more than its later offtake
    capitalisation, and a newest-first list would say otherwise.

    The id is the last key so the order is total. Two rows tied on all three
    real keys would otherwise come back in whatever order the corpus happened
    to hold them, and a list that reshuffles between requests reads as new
    information.
    """

    def key(dev: R) -> tuple[int, float, int, str]:
        return (
            -PRIORITY_RANK.get(dev.priority or "", 0),
            -(dev.relevance_score or 0.0),
            -(dev.published_at.toordinal() if dev.published_at else 0),
            dev.id,
        )

    return sorted(developments, key=key)


def _development(article: Article) -> schemas.OSINTDevelopment:
    """One corpus article as a development. The only corpus-aware function here."""
    return schemas.OSINTDevelopment(
        id=article.id,
        title=article.title,
        source=schemas.OSINTSource(name=article.source, url=article.source_url),
        published_at=article.published_at,
        category=article.category,
        priority=article.priority,
        relevance_score=article.relevance_score,
        summary=article.summary,
        what_changed=article.what_changed,
        why_it_matters=article.why_it_matters,
        tags=list(article.tags),
    )


def get_node_osint(corpus: Corpus, node_id: str) -> schemas.NodeOSINT:
    """Ranked developments for one node.

    A node the corpus does not cover gets an empty list, not an error. The
    caller has already established that the node exists; "nothing found" and
    "not monitored" are different answers, and only the first is true here.
    """
    node = corpus.nodes.get(node_id)
    developments = [_development(a) for a in node.articles] if node else []
    return schemas.NodeOSINT(
        node_id=node_id,
        generated_at=corpus.metadata.generated_at,
        # Null until a producer records it. See the schema module docstring.
        sources_analyzed=None,
        ranking_note=corpus.metadata.demo_disclaimer,
        developments=rank_developments(developments),
    )
