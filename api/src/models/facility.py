"""Processing Facility: transforms mined material into more refined products."""

import math
from dataclasses import dataclass
from enum import StrEnum

from src.models._validation import require_in_range, require_non_blank
from src.models.geography import Coordinates
from src.models.lifecycle import OperatingStatus
from src.models.provenance import Attested


class FacilityType(StrEnum):
    BENEFICIATION = "BENEFICIATION"
    #: Integrated cracking / leaching / separation to separated oxides.
    REFINERY = "REFINERY"
    SEPARATION = "SEPARATION"
    METALLIZATION_AND_ALLOYING = "METALLIZATION_AND_ALLOYING"
    MAGNET_MANUFACTURING = "MAGNET_MANUFACTURING"
    RECYCLING = "RECYCLING"
    OTHER = "OTHER"


@dataclass(frozen=True)
class Capacity:
    """Nominal or planned throughput of one material, in tonnes per year."""

    material_id: str
    tonnes_per_year: float

    def __post_init__(self) -> None:
        require_non_blank("material_id", self.material_id)
        require_in_range("tonnes_per_year", self.tonnes_per_year, 0.0, math.inf)


@dataclass(frozen=True)
class ProcessingFacility:
    id: str
    name: str
    facility_type: FacilityType
    country_id: str
    operating_status: Attested[OperatingStatus]
    operator_id: str | None = None
    location_description: str | None = None
    coordinates: Attested[Coordinates] | None = None
    input_material_ids: tuple[str, ...] = ()
    output_material_ids: tuple[str, ...] = ()
    capacities: tuple[Attested[Capacity], ...] = ()
    #: Year operations are expected to begin, where under development.
    expected_start: Attested[int] | None = None
    description: str | None = None
    aliases: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        require_non_blank("id", self.id)
        require_non_blank("name", self.name)
        require_non_blank("country_id", self.country_id)
