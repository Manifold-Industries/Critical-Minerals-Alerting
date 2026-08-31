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
    INVESTED_IN = "INVESTED_IN"
    ALTERNATIVE_TO = "ALTERNATIVE_TO"


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
