"""Response models for per-node OSINT.

Generic on purpose. Nothing here names a mineral, a mine or a publisher, and
nothing carries a field only this corpus could fill. The console renders
whatever comes back, so the same contract has to survive being produced by a
curated file today and by collection -> entity resolution -> extraction ->
ranking later. Anything domain-specific would have to be unlearned when it is.

Two consequences worth stating, because both look like omissions:

``relevance_score`` is a ranking output, not calibrated confidence. It is
returned so a client can re-sort, and the console deliberately never shows it:
"98%" beside a headline reads as certainty about the world, which is a claim
nobody here is making. ``priority`` is the label meant for a reader.

``sources_analyzed`` is nullable and stays null for a corpus that does not
record how many documents it screened. The field is in the contract for a
collector that does; filling it with a plausible number would be inventing a
measurement, which the seed data forbids for the same reason.
"""

from datetime import date

from pydantic import BaseModel, Field


class OSINTSource(BaseModel):
    """Where the development was published."""

    name: str
    #: ``None`` on an unanchored item. A client must not render a dead link.
    url: str | None = None


class OSINTDevelopment(BaseModel):
    """One prioritized development affecting the node.

    Every field below ``source`` is optional in the contract even where this
    corpus always fills it, because the client has to tolerate a collector
    that cannot extract one of them.
    """

    id: str
    title: str
    source: OSINTSource
    published_at: date | None = None
    #: Free string, never an enum. A new domain introduces categories this
    #: service has never seen and must pass them through unchanged; the client
    #: formats whatever arrives.
    category: str | None = None
    #: VERY_HIGH / HIGH / MEDIUM / LOW in this corpus. Also a free string: the
    #: ranking handles a label it does not recognise rather than rejecting it.
    priority: str | None = None
    #: For sorting. See the module docstring before rendering it.
    relevance_score: float | None = None
    summary: str | None = None
    what_changed: str | None = None
    why_it_matters: str | None = None
    tags: list[str] = Field(default_factory=list)


class NodeOSINT(BaseModel):
    """Everything the console needs for one node's OSINT section."""

    node_id: str
    #: When the corpus behind this response was produced. Not a request time:
    #: a precomputed answer must not date itself to the moment it was served.
    generated_at: date | None = None
    #: How many documents were screened to produce ``developments``. Null where
    #: the producer does not record it - see the module docstring.
    sources_analyzed: int | None = None
    #: What the ordering is and is not, in the producer's own words. The client
    #: cannot know how the ranking was made, so it must not author this.
    ranking_note: str | None = None
    #: Best first. Ranked by the server, because how the order was arrived at
    #: is exactly what the client is not supposed to know.
    developments: list[OSINTDevelopment] = Field(default_factory=list)
