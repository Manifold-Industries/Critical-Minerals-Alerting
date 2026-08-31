"""Deposit: the underlying geological resource.

Primary source is the USGS Global Rare Earth Element Occurrence Database,
which is treated as the geological asset layer only — *not* as authoritative
for current project-development status (that lives on ``Project``).
"""

import math
from dataclasses import dataclass
from enum import StrEnum

from src.models._validation import require_in_range, require_non_blank
from src.models.geography import Coordinates
from src.models.provenance import Attested, Provenance


class ResourceClassification(StrEnum):
    """JORC / NI 43-101 style resource and reserve categories."""

    MEASURED = "MEASURED"
    INDICATED = "INDICATED"
    INFERRED = "INFERRED"
    PROVED = "PROVED"
    PROBABLE = "PROBABLE"


@dataclass(frozen=True)
class ResourceEstimate:
    """A single resource/reserve statement, with the provenance of that claim."""

    classification: ResourceClassification
    ore_tonnes: float
    provenance: Provenance
    #: Grade as a percentage of ore mass (e.g. 0.66 for 0.66% TREO).
    grade_pct: float | None = None
    #: What the grade is measured against, e.g. "TREO", "Dy2O3".
    grade_basis: str | None = None
    #: Contained metal/oxide tonnes implied by tonnage × grade, where stated.
    contained_tonnes: float | None = None

    def __post_init__(self) -> None:
        require_in_range("ore_tonnes", self.ore_tonnes, 0.0, math.inf)
        require_in_range("contained_tonnes", self.contained_tonnes, 0.0, math.inf)
        require_in_range("grade_pct", self.grade_pct, 0.0, 100.0)


@dataclass(frozen=True)
class Deposit:
    id: str
    name: str
    country_id: str
    #: Element symbols present, e.g. ("Dy", "Tb", "Y").
    commodities: tuple[str, ...]
    #: Point location; attested because location and status may cite different sources.
    coordinates: Attested[Coordinates] | None = None
    #: Deposit footprint as WKT, if available.
    geometry_wkt: str | None = None
    #: Free-form to match USGS classification (e.g. "Carbonatite", "Ion-adsorption clay").
    deposit_type: str | None = None
    resource_estimates: tuple[ResourceEstimate, ...] = ()
    location_description: str | None = None
    aliases: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        require_non_blank("id", self.id)
        require_non_blank("name", self.name)
        require_non_blank("country_id", self.country_id)
        if not self.commodities or any(not c.strip() for c in self.commodities):
            raise ValueError("commodities must contain at least one non-blank element symbol")
