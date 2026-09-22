"""The OSINT corpus as it sits on disk, validated at the boundary.

Deliberately **not** part of ``SupplyGraph``. The graph is an evidence store:
every claim on it is wrapped in a ``Provenance`` that names the document it was
read from, how confident that reading is, and whether a person has checked it.
An OSINT development is a different kind of object - an article, a ranking
label and some prose about why it matters - produced on a different cadence by
a different process. Folding it into the graph would put ranking outputs beside
attested claims and put news publishers into ``sources.json``, which the seed
data reserves for documents a graph claim actually cites.

So it is loaded beside the graph and joined to it only by ``node_id``. That
join is the one thing this module owes the graph, and it is the one thing
``validate`` checks: an association to a node that does not exist is the OSINT
equivalent of a citation nothing can resolve.

The shape here mirrors the upstream feed rather than this repo's seed-file
convention, because that is what it is - a snapshot of something produced
elsewhere. Mapping it onto the generic frontend contract happens in
``src/service/osint.py``, which is the seam a real collector would replace.
"""

import json
from datetime import date
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, Field

#: Beside the seed data, because it is data the API serves. Read the module
#: docstring before concluding it belongs in ``build()``.
CORPUS_PATH = Path(__file__).resolve().parent.parent / "data" / "osint.json"


class Article(BaseModel):
    """One development, as the collector recorded it.

    ``category`` and ``priority`` are free strings rather than enums on
    purpose. A new domain introduces categories nobody has written down yet,
    and narrowing them here would mean a schema change every time the corpus
    widened - which is exactly the coupling the generic contract exists to
    avoid. Ranking handles a priority it does not recognise; see
    ``service.osint.rank_developments``.
    """

    id: str
    published_at: date
    title: str
    #: Publication or filer, as a display name. Not a ``src-`` id: nothing here
    #: is cited by a graph claim, so there is no ``Source`` record to point at.
    source: str
    #: ``None`` on an unanchored article. A client must not render a link.
    source_url: str | None = None
    category: str
    priority: str
    #: Ranking output in [0, 1], not calibrated confidence. It exists to order
    #: the list and is deliberately not surfaced as a percentage anywhere.
    relevance_score: float | None = None
    tags: list[str] = Field(default_factory=list)
    what_changed: str | None = None
    summary: str | None = None
    why_it_matters: str | None = None


class CorpusNode(BaseModel):
    """Every development associated with one node of the world model."""

    node_id: str
    node_name: str
    #: Surface forms the collector resolved to this node. Kept because they are
    #: what an automated collector would match on; nothing serves them today.
    aliases: list[str] = Field(default_factory=list)
    articles: list[Article] = Field(default_factory=list)


class CorpusMetadata(BaseModel):
    corpus_name: str
    generated_at: date
    scope: str | None = None
    #: What the ranking labels are and are not. Travels with every response:
    #: the console cannot know how the order was produced, so it must not be
    #: the thing that describes it.
    demo_disclaimer: str | None = None
    ranking_intent: str | None = None


class Corpus(BaseModel):
    metadata: CorpusMetadata
    #: By node id, so a lookup is a dict hit rather than a scan.
    nodes: dict[str, CorpusNode]


class CorpusError(ValueError):
    """The corpus on disk is unusable. Raised at load, never per request."""


def parse(raw: object) -> Corpus:
    """Validate one decoded corpus document.

    Separate from ``load_corpus`` so a caller can check a candidate file - a
    freshly collected batch, say - without writing it to the seed path first.
    """
    if not isinstance(raw, dict):
        raise CorpusError("corpus must be a JSON object")
    metadata = CorpusMetadata.model_validate(raw.get("metadata", {}))
    nodes = [CorpusNode.model_validate(node) for node in raw.get("nodes", [])]

    by_id: dict[str, CorpusNode] = {}
    for node in nodes:
        if node.node_id in by_id:
            raise CorpusError(f"duplicate node {node.node_id!r} in corpus")
        by_id[node.node_id] = node

    seen: set[str] = set()
    for node in nodes:
        for article in node.articles:
            if article.id in seen:
                raise CorpusError(f"duplicate article id {article.id!r} in corpus")
            seen.add(article.id)

    return Corpus(metadata=metadata, nodes=by_id)


def validate(corpus: Corpus, known_node_ids: set[str]) -> list[str]:
    """Node ids in the corpus that name nothing in the world model.

    Returned rather than raised: a stale association is a data problem to
    report, not a reason to refuse every other node its OSINT. ``main`` logs
    them at startup; the endpoint serves the rest regardless.
    """
    return sorted(node_id for node_id in corpus.nodes if node_id not in known_node_ids)


@lru_cache(maxsize=1)
def load_corpus() -> Corpus:
    """The corpus on disk, parsed once and shared.

    Raises ``CorpusError`` where the file is missing or malformed. Failing at
    load rather than per request means a broken corpus is a startup failure,
    not a page of half-rendered cards.
    """
    try:
        raw = json.loads(CORPUS_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError as err:
        raise CorpusError(f"no OSINT corpus at {CORPUS_PATH}") from err
    except json.JSONDecodeError as err:
        raise CorpusError(f"OSINT corpus at {CORPUS_PATH} is not valid JSON: {err}") from err
    return parse(raw)
