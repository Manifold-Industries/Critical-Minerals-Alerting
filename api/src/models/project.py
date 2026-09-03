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
from src.models.material import HostMineral
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
class ProductForm:
    """A form in which material physically *leaves* an asset.

    Deliberately narrower than ``ProductionFigure``, which mixes shipped forms
    with contained-metal accounting: a mine that ships concentrate still reports
    contained Dy2O3 tonnes, and both land in ``planned_production``. Only a
    stream that a counterparty could take delivery of belongs here.

    An asset may ship several forms - Round Top's own concentrate and the
    "excess concentrate" it has discussed sending to Caremag are different
    products - so this is a tuple, not a scalar.
    """

    material_id: str
    #: What a receiving plant has to process. See ``HostMineral``.
    host_mineral: HostMineral
    #: Grade as % TREO of product mass, where disclosed.
    grade_pct_treo: float | None = None
    #: Basis, caveat, or the disclosure this form was read from.
    note: str | None = None

    def __post_init__(self) -> None:
        require_non_blank("material_id", self.material_id)
        require_in_range("grade_pct_treo", self.grade_pct_treo, 0.0, 100.0)


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
    #: Forms this mine actually ships. Feeds route inference; see ``ProductForm``.
    products: tuple[Attested[ProductForm], ...] = ()
    resource_estimates: tuple[ResourceEstimate, ...] = ()
    description: str | None = None
    aliases: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        require_non_blank("id", self.id)
        require_non_blank("name", self.name)
        require_non_blank("country_id", self.country_id)
