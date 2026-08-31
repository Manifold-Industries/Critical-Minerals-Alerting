"""Project / Mine: the commercial development of a deposit.

Primary sources are corporate filings (feasibility studies, annual reports,
ASX/SEC disclosures) and government project announcements. Decision-relevant
fields — stage, status, start date, production — are ``Attested`` so that each
can cite its own source and be updated independently as disclosures evolve.
"""

import math
from dataclasses import dataclass
from enum import StrEnum

from src.models._validation import require_in_range, require_non_blank
from src.models.deposit import ResourceEstimate
from src.models.lifecycle import DevelopmentStage, OperatingStatus
from src.models.provenance import Attested


class ProductionPeriod(StrEnum):
    ANNUAL = "ANNUAL"
    LIFE_OF_MINE = "LIFE_OF_MINE"


@dataclass(frozen=True)
class ProductionFigure:
    """A stated production quantity of one material."""

    material_id: str
    tonnes: float
    period: ProductionPeriod
    #: Year the figure is expected to be reached (e.g. "6,400 tpa by end of 2027").
    target_year: int | None = None
    #: Basis / caveat, e.g. "REO-equivalent contained in MREC".
    note: str | None = None

    def __post_init__(self) -> None:
        require_non_blank("material_id", self.material_id)
        require_in_range("tonnes", self.tonnes, 0.0, math.inf)


@dataclass(frozen=True)
class Project:
    id: str
    name: str
    country_id: str
    development_stage: Attested[DevelopmentStage]
    operating_status: Attested[OperatingStatus]
    deposit_id: str | None = None
    operator_id: str | None = None
    #: Year first production is expected (or occurred).
    expected_production_start: Attested[int] | None = None
    planned_production: tuple[Attested[ProductionFigure], ...] = ()
    resource_estimates: tuple[ResourceEstimate, ...] = ()
    description: str | None = None
    aliases: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        require_non_blank("id", self.id)
        require_non_blank("name", self.name)
        require_non_blank("country_id", self.country_id)
