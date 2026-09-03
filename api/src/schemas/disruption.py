"""Pydantic response models for the disruption API.

These mirror ``src.disruption`` rather than the console's view model. The
qualitative fields the ranking rests on - ``evidence_class``, ``basis_comparable``,
``already_committed_to``, ``note`` - are carried through deliberately: the module
docstring in ``src.disruption`` states that JOGMEC's right of first refusal over
Lofdal and Carina's designation to Project Dynamo live only in edge prose, so a
client that drops them will present a ranking whose caveats have been discarded.

Presentation decisions are left to the client. There is no "impact level" here,
because the graph has no such concept: ``sole_source`` and ``remaining_supplies_in``
are the facts, and how they colour a marker is the console's business.
"""

from pydantic import BaseModel, Field


class Coordinates(BaseModel):
    lat: float
    lon: float


class Provenance(BaseModel):
    type: str
    source_id: str | None = None
    assertion_confidence: str | None = None


class FeedQuantity(BaseModel):
    tonnes: float
    #: Where in the chain the figure was struck. Two tonnages on different bases
    #: are not comparable without a recovery factor the graph does not carry.
    basis: str
    #: False for a life-of-mine total, which is not annualisable.
    is_annual_rate: bool
    provenance: Provenance
    caveats: list[str] = []


class AlternativeFeed(BaseModel):
    """One candidate source for a plant that lost feed, with why it ranked where it did."""

    rank: int
    source_id: str
    name: str | None = None
    country_id: str | None = None
    country_name: str | None = None
    coordinates: Coordinates | None = None
    relationship_id: str
    #: 0 curated, 1 automated. The inferred layer describes itself as "not
    #: evidence"; a client that hides this cannot tell the two apart.
    evidence_class: int
    qualification: str | None = None
    qualification_lead_months: int | None = None
    status: str
    alignment: str | None = None
    #: False where the country carries no alignment assessment at all, which is
    #: not the same as being assessed NEUTRAL.
    alignment_known: bool
    available_feed: FeedQuantity | None = None
    months_to_flow: int | None = None
    #: False where no start year is stated. Readiness is unknown, not immediate.
    readiness_known: bool
    #: False where this tonnage and the lost tonnage were struck at different
    #: points in the chain, so any coverage ratio between them is an upper bound.
    basis_comparable: bool
    #: Plants this source is already contracted or observed to supply.
    already_committed_to: list[str] = []
    #: Edge prose, passed through verbatim - it can carry commercial foreclosure
    #: that nothing machine-readable in the graph expresses.
    note: str | None = None
    #: How the available tonnage compares with the tonnage lost. COVERS, PARTIAL
    #: or UNSIZED. Read with ``basis_comparable``: where that is false the two
    #: figures were struck at different points in the chain and any ratio is an
    #: upper bound, not a coverage estimate.
    coverage: str
    #: Fraction of the gap this source covers, on PARTIAL only.
    covered_fraction: float | None = None
    #: Why this row sorts below the one above it, within the same facility - the
    #: first ``RankingKey`` field on which the two differ. ``None`` on the top
    #: row. The key is lexicographic, so this is the whole reason for the order,
    #: not a contributing factor among several.
    decisive_factor: str | None = None
    #: True where the only field separating this row from the one above is the
    #: deterministic id tiebreak: the two are indistinguishable on every
    #: substantive axis, and presenting them as ranked invents a distinction.
    tied_with_previous: bool = False
    #: The row ``decisive_factor`` was measured against. A client that reorders,
    #: filters or deduplicates these rows must check this still names the row it
    #: actually displays above, or the comparison it shows is not the one made.
    decisive_against: str | None = None


class PathNode(BaseModel):
    """A node on the route from the disrupted mine to an affected plant.

    Carries enough to render like any other node: an intermediate such as
    Kalgoorlie is a real plant losing its own feed, not a waypoint.
    """

    id: str
    name: str | None = None
    facility_type: str | None = None
    operating_status: str | None = None
    country_id: str | None = None
    country_name: str | None = None
    coordinates: Coordinates | None = None


class FacilityImpact(BaseModel):
    facility_id: str
    name: str | None = None
    facility_type: str
    country_id: str | None = None
    country_name: str | None = None
    coordinates: Coordinates | None = None
    #: Hops from the mine. Not every mine reaches a refiner in one.
    hops: int
    via_relationship_ids: list[str] = []
    #: Mine first, this plant last, so a client can draw the traversed route
    #: including any intermediate it passed through.
    path: list[PathNode] = []
    nameplate_dytb_tpa: float | None = None
    operating_status: str
    sole_source: bool
    remaining_supplies_in: int
    #: Lost tonnage as a fraction of this plant's Dy+Tb nameplate at
    #: ``as_of_year``. ``None`` where either figure is missing or the loss is a
    #: life-of-mine total. An upper bound: mine figures are contained metal and
    #: facility figures are separated-oxide nameplate, and the graph carries no
    #: recovery factor to reconcile them.
    share_of_nameplate: float | None = None
    #: This plant's Dy+Tb nameplate as a fraction of all *disclosed* Dy+Tb
    #: separation capacity in the graph at ``as_of_year``. ``None`` where the
    #: plant discloses no nameplate - unsized, which is not the same as zero.
    #: See ``CapacityContext`` for what the denominator does and does not cover.
    share_of_modelled_capacity: float | None = None
    alternatives: list[AlternativeFeed] = []


class CapacityContext(BaseModel):
    """Dy+Tb separation capacity in the graph, and how much of it this outage touches.

    "Modelled" is load-bearing in every field name here. The denominator counts
    only refiners that disclose a nameplate, so it is a floor, and every share
    computed against it therefore *overstates* the true share. The graph is also
    scoped to non-Chinese capacity, so this is not a world total and must never
    be presented as one.
    """

    as_of_year: int
    #: Sum of disclosed Dy+Tb nameplate across every Dy/Tb refiner in the graph.
    total_tpa: float
    refiners_disclosing: int
    refiners_total: int
    #: Disclosed nameplate of the affected plants, and its share of the total.
    #: Both ``None`` where no affected plant discloses one - which a client must
    #: render as "not disclosed", never as zero: the exposure is real but unsized.
    affected_tpa: float | None = None
    affected_share: float | None = None
    #: Affected plants carrying no disclosed nameplate. Their exposure is real
    #: and is missing from ``affected_share`` entirely.
    undisclosed_facility_ids: list[str] = []


class DisruptionResponse(BaseModel):
    mine_id: str
    mine_name: str | None = None
    country_id: str | None = None
    country_name: str | None = None
    coordinates: Coordinates | None = None
    as_of_year: int
    #: See ``MineSummary.earliest_year``.
    earliest_year: int | None = None
    #: True where ``as_of_year`` precedes the mine's own expected production
    #: start: the simulation still runs, but it is disrupting output nobody has
    #: said will exist yet.
    before_production_start: bool = False
    severity: float
    lost_feed: FeedQuantity | None = None
    impacted: list[FacilityImpact] = []
    #: Systemic weight of the plants that lost feed. See ``CapacityContext``.
    capacity_context: CapacityContext | None = None
    #: Conditions the caller should surface rather than swallow.
    warnings: list[str] = []


class YearRange(BaseModel):
    """Years over which the graph says anything different.

    Capacities and production figures are staged and supersede one another, so
    outside this band every year returns the same answer as the nearest edge of
    it. Derived from the data rather than fixed, so it follows the seed files.
    """

    min_year: int
    max_year: int
    default_year: int


class MineSummary(BaseModel):
    mine_id: str
    name: str
    country_id: str
    country_name: str | None = None
    operating_status: str
    #: First year the mine is expected to produce. ``None`` where it already
    #: does, or where no start year is disclosed - which are different things,
    #: so ``operating_status`` has to be read alongside this.
    earliest_year: int | None = None
    coordinates: Coordinates | None = None
    #: Whether this mine reaches any Dy/Tb refiner, i.e. whether simulating it
    #: returns any impact at all.
    reaches_refiner: bool = Field(
        description="False means a disruption here has no modelled downstream effect"
    )
