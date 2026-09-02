"""Processing Facility: transforms mined material into more refined products."""

import math
from dataclasses import dataclass
from enum import StrEnum

from src.models._validation import require_in_range, require_non_blank
from src.models.geography import Coordinates
from src.models.lifecycle import OperatingStatus
from src.models.material import HostMineral
from src.models.project import ProductForm
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
    """Nominal or planned throughput of one material, in tonnes per year.

    Mirrors ``ProductionFigure`` on ``Project``: staged expansions and the
    caveats attached to a number are part of the claim, not commentary. A
    facility may carry several entries for the same material at different
    ``target_year`` values, so entries are *not* additive - read ``note``.
    """

    material_id: str
    tonnes_per_year: float
    #: Year the capacity is expected to be reached, where staged.
    target_year: int | None = None
    #: Basis / caveat, e.g. "nameplate processing capacity, not a production target".
    note: str | None = None

    def __post_init__(self) -> None:
        require_non_blank("material_id", self.material_id)
        require_in_range("tonnes_per_year", self.tonnes_per_year, 0.0, math.inf)


@dataclass(frozen=True)
class FeedSpec:
    """One class of material a facility has publicly said it can take.

    A *coarse product-class descriptor*, not a statement about any particular
    supplier: compatibility with a specific source stays on the edge, where it
    can carry its own provenance and its own qualification tier. The two layers
    are maintained separately and are allowed to disagree - when they do, the
    disagreement is the finding, not a data error to be tidied away.

    ``accepted_hosts`` narrows the class where the operator has been specific
    about mineralogy. Left empty it means "any host of this material", which is
    the honest reading of most disclosures.
    """

    material_id: str
    #: Hosts the plant's front end can take. Empty = unconstrained / not disclosed.
    accepted_hosts: tuple[HostMineral, ...] = ()
    #: The stated envelope, ideally in the operator's own words.
    note: str | None = None

    def __post_init__(self) -> None:
        require_non_blank("material_id", self.material_id)

    def accepts(self, form: ProductForm) -> bool:
        """Whether ``form`` falls inside this declared class on form alone."""
        if form.material_id != self.material_id:
            return False
        return not self.accepted_hosts or form.host_mineral in self.accepted_hosts


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
    #: Declared feed envelope, each class citing the disclosure it was read from.
    accepted_feeds: tuple[Attested[FeedSpec], ...] = ()
    #: Forms this plant ships onward, so refinery-to-refinery routes can be inferred.
    products: tuple[Attested[ProductForm], ...] = ()
    capacities: tuple[Attested[Capacity], ...] = ()
    #: Year operations are expected to begin, where under development.
    expected_start: Attested[int] | None = None
    description: str | None = None
    aliases: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        require_non_blank("id", self.id)
        require_non_blank("name", self.name)
        require_non_blank("country_id", self.country_id)

    @property
    def input_material_ids(self) -> tuple[str, ...]:
        """Coarse view of ``accepted_feeds``, deduplicated, order preserved."""
        return tuple(dict.fromkeys(a.value.material_id for a in self.accepted_feeds))

    @property
    def output_material_ids(self) -> tuple[str, ...]:
        """Coarse view of ``products``, deduplicated, order preserved."""
        return tuple(dict.fromkeys(a.value.material_id for a in self.products))
