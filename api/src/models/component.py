"""Component: a manufactured part that depends on critical materials."""

from dataclasses import dataclass

from src.models._validation import require_non_blank
from src.models.provenance import Attested


@dataclass(frozen=True)
class Component:
    id: str
    name: str
    category: str
    #: Material ids this component requires — a technical dependency, each with provenance.
    requires: tuple[Attested[str], ...] = ()
    defense_relevant: bool = False

    def __post_init__(self) -> None:
        require_non_blank("id", self.id)
        require_non_blank("name", self.name)
