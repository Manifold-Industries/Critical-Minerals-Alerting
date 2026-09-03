"""Relationship: a provenance-bearing edge between two entities.

Only edges that are not already expressed as entity fields live here.
``Component.requires`` / ``System.requires`` carry the functional dependencies;
``Project.deposit_id`` / ``operator_id`` and facility input/output materials
carry the structural ones.
"""

import math
from dataclasses import dataclass
from enum import StrEnum

from src.models._validation import require_in_range, require_non_blank
from src.models.provenance import Provenance


class RelationshipType(StrEnum):
    #: Physical flow of material from one asset to another.
    SUPPLIES = "SUPPLIES"
    #: Technical capability for a flow that is *not* currently happening or contracted.
    #: Use for rerouting candidates; ``SUPPLIES`` already implies compatibility.
    CAN_SUPPLY = "CAN_SUPPLY"
    INVESTED_IN = "INVESTED_IN"
    ALTERNATIVE_TO = "ALTERNATIVE_TO"


class QualificationTier(StrEnum):
    """How well established it is that a feed can actually be processed by a facility.

    Orthogonal to ``RelationshipStatus``: that records whether material *does* flow
    (commercial and evidentiary status), this records whether it *could* (technical
    status). A route can be QUALIFIED but not contracted, or CONTRACTED on a feed
    whose qualification rests only on the operator's stated feed envelope.

    Compatibility is never inferred from material category or id: two streams sharing
    ``mat-mrec`` say nothing about whether one plant can run the other's material.
    """

    #: Testwork done, contract signed, or the operator names this specific feed.
    QUALIFIED = "QUALIFIED"
    #: The operator states it accepts this *class* of material, but not this source.
    FEED_ENVELOPE = "FEED_ENVELOPE"
    #: Chemistry and mineralogy suggest it could be made to work; no public evidence.
    PLAUSIBLE = "PLAUSIBLE"
    #: No reasonable short-run pathway - flowsheet or product form rules it out.
    INFEASIBLE = "INFEASIBLE"


class RelationshipStatus(StrEnum):
    """Evidentiary status of the edge — edges are not all equally certain."""

    OBSERVED = "OBSERVED"
    CONTRACTED = "CONTRACTED"
    PLANNED = "PLANNED"
    POTENTIAL = "POTENTIAL"
    #: The relationship is required but its counterparty is not publicly established.
    UNRESOLVED = "UNRESOLVED"
    HISTORICAL = "HISTORICAL"


@dataclass(frozen=True)
class Relationship:
    id: str
    type: RelationshipType
    from_id: str
    #: ``None`` only when status is UNRESOLVED.
    to_id: str | None
    status: RelationshipStatus
    provenance: Provenance
    material_ids: tuple[str, ...] = ()
    #: Technical qualification of the route, where assessed. See ``QualificationTier``.
    qualification: QualificationTier | None = None
    #: Modelling heuristic: months of assay/testwork/qualification before the route
    #: could carry material. Not a company-disclosed lead time - record as a
    #: MODEL_ESTIMATE and say so in ``note``.
    qualification_lead_months: int | None = None
    annual_tonnes: float | None = None
    total_tonnes: float | None = None
    start_year: int | None = None
    end_year: int | None = None
    note: str | None = None

    def __post_init__(self) -> None:
        require_non_blank("id", self.id)
        require_non_blank("from_id", self.from_id)
        if self.to_id is None and self.status is not RelationshipStatus.UNRESOLVED:
            raise ValueError(f"{self.id}: to_id may only be None when status is UNRESOLVED")
        require_in_range("annual_tonnes", self.annual_tonnes, 0.0, math.inf)
        require_in_range("total_tonnes", self.total_tonnes, 0.0, math.inf)
        require_in_range("qualification_lead_months", self.qualification_lead_months, 0.0, math.inf)
        if self.type is RelationshipType.CAN_SUPPLY and self.qualification is None:
            raise ValueError(f"{self.id}: CAN_SUPPLY requires a qualification tier")
