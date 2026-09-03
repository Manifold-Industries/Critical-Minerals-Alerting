"""Pydantic response models for per-asset detail.

Deliberately wider than the disruption schemas, which carry only what the
ranking needs. This is the reference view: the full staged capacity record
rather than the single figure in force, every production figure rather than the
combined Dy+Tb the engine derives, and the note on each so a reader can see what
the number rests on.

Staged figures **supersede** rather than accumulate. White Mesa holds Dy at
120 t (2027) and 288 t (2029) for the same circuit; the later entry replaces the
earlier one. Summing a material's rows would overstate it, so ``superseded_by``
marks the rows a later entry has already replaced.

Attribution
-----------
Every row that rests on a document carries a ``provenance``, and ``sources``
resolves the ``source_id`` on it into the document itself - name, publisher,
date, url and the locator that says where in it to look. A bare id is not
attribution: nothing downstream can turn ``src-iluka-ar25-2025`` into something
a reader can check.

Two confidences travel together and are not interchangeable.
``Provenance.assertion_confidence`` is confidence in the specific conclusion
drawn; ``SourceRef.source_confidence`` is confidence in the document it was
drawn from. A high-confidence reading of a weak source is not a strong claim,
and collapsing the two would say it was.
"""

from datetime import date

from pydantic import BaseModel

from src.schemas.disruption import Coordinates, Provenance


class SourceRef(BaseModel):
    """A document cited by something in this response.

    Returned in order of first citation within this payload, so a client can
    number them and point each row at its entry. That ordering is the only
    thing tying a row to a source, so a client must not re-sort this list.
    """

    id: str
    name: str
    source_type: str
    publisher: str | None = None
    published_on: date | None = None
    #: ``None`` on an unanchored source - one with no retrievable location.
    #: A client must not render a dead link in its place.
    url: str | None = None
    #: Page, table or section within the source. Often long; it is what makes a
    #: 200-page annual report checkable rather than merely cited.
    locator: str | None = None
    #: Confidence in the document itself, not in any conclusion drawn from it.
    source_confidence: str | None = None


class MaterialFigure(BaseModel):
    """A stated quantity, the material it is in, and what it rests on."""

    material_id: str
    material_name: str | None = None
    elements: list[str] = []
    tonnes: float
    #: ANNUAL or LIFE_OF_MINE for a mine. None on a facility, where every
    #: capacity is per year by definition.
    period: str | None = None
    target_year: int | None = None
    #: Target year of the entry that replaces this one, where a later entry for
    #: the same material exists. Non-null means this row is no longer in force.
    superseded_by: int | None = None
    note: str | None = None
    provenance: Provenance


class FeedSpec(BaseModel):
    """A class of material the plant has publicly said it can take."""

    material_id: str
    material_name: str | None = None
    #: Hosts the front end can handle. Empty means unconstrained or undisclosed,
    #: which is the honest reading of most disclosures.
    accepted_hosts: list[str] = []
    note: str | None = None
    provenance: Provenance


class ProductForm(BaseModel):
    """A form in which material physically leaves the asset."""

    material_id: str
    material_name: str | None = None
    host_mineral: str
    grade_pct_treo: float | None = None
    note: str | None = None
    provenance: Provenance


class LinkedAsset(BaseModel):
    """A counterparty on one edge, with the standing of that edge."""

    id: str | None = None
    name: str | None = None
    relationship_id: str
    type: str
    status: str
    #: True for the generated layer, which states that it is not evidence.
    inferred: bool = False
    qualification: str | None = None
    note: str | None = None
    #: The edge's own provenance. An inferred edge cites no document and says
    #: so through ``type``; it is not an uncited curated one.
    provenance: Provenance


class DepositSummary(BaseModel):
    id: str
    name: str
    deposit_type: str | None = None
    commodities: list[str] = []
    location_description: str | None = None


class AssetDetail(BaseModel):
    id: str
    #: MINE or FACILITY. A mine's location is its deposit's; see ``coordinates``.
    kind: str
    name: str
    country_id: str | None = None
    country_name: str | None = None
    coordinates: Coordinates | None = None
    operating_status: str
    operating_status_provenance: Provenance | None = None
    #: Mines only.
    development_stage: str | None = None
    development_stage_provenance: Provenance | None = None
    #: Facilities only.
    facility_type: str | None = None
    #: Expected production start (mine) or operations start (facility).
    expected_start: int | None = None
    expected_start_provenance: Provenance | None = None
    operator_id: str | None = None
    operator_name: str | None = None
    deposit: DepositSummary | None = None
    #: Production figures (mine) or nameplate capacities (facility). Staged and
    #: superseding - read ``superseded_by`` before summing anything.
    figures: list[MaterialFigure] = []
    accepted_feeds: list[FeedSpec] = []
    products: list[ProductForm] = []
    supplied_by: list[LinkedAsset] = []
    supplies_to: list[LinkedAsset] = []
    #: Whether this plant ships a dedicated Dy/Tb stream.
    is_dytb_refiner: bool = False
    location_description: str | None = None
    description: str | None = None
    aliases: list[str] = []
    #: Every document cited by a ``provenance`` above, in order of first
    #: citation. A provenance whose ``type`` needs no source - a judgment, an
    #: inference, a model estimate - contributes nothing here, so this list is
    #: shorter than the number of claims and deliberately so.
    sources: list[SourceRef] = []
