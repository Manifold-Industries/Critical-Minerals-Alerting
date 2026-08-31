"""Organization: companies, governments, SOEs, investors and operators."""

from dataclasses import dataclass
from enum import StrEnum

from src.models._validation import require_non_blank
from src.models.provenance import Attested


class OrganizationType(StrEnum):
    COMPANY = "COMPANY"
    STATE_OWNED_ENTERPRISE = "STATE_OWNED_ENTERPRISE"
    GOVERNMENT = "GOVERNMENT"
    INVESTOR = "INVESTOR"
    OTHER = "OTHER"


@dataclass(frozen=True)
class Organization:
    id: str
    name: str
    organization_type: OrganizationType
    headquarters_country_id: str | None = None
    #: Ultimate or immediate parent, where the organization is a subsidiary.
    parent_organization_id: str | None = None
    #: Stock exchange listing, e.g. "ASX:NTU".
    listing: str | None = None
    #: Government ownership / affiliation, only where sourced (e.g. "PRC state-owned").
    government_affiliation: Attested[str] | None = None
    aliases: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        require_non_blank("id", self.id)
        require_non_blank("name", self.name)
