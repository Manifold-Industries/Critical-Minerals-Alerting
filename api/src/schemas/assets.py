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
"""

from pydantic import BaseModel

from src.schemas.disruption import Coordinates, Provenance


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


class ProductForm(BaseModel):
    """A form in which material physically leaves the asset."""

    material_id: str
    material_name: str | None = None
    host_mineral: str
    grade_pct_treo: float | None = None
    note: str | None = None


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
    #: Mines only.
    development_stage: str | None = None
    #: Facilities only.
    facility_type: str | None = None
    #: Expected production start (mine) or operations start (facility).
    expected_start: int | None = None
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
