"""System: a major end system that depends on modelled components.

Dependencies are *functional* — the system needs the component class — not
claims that material from a particular mine reached a particular unit.
"""

from dataclasses import dataclass

from src.models._validation import require_non_blank
from src.models.provenance import Attested


@dataclass(frozen=True)
class System:
    id: str
    name: str
    category: str
    #: Component ids this system requires, each with provenance.
    requires: tuple[Attested[str], ...] = ()
    operator: str | None = None

    def __post_init__(self) -> None:
        require_non_blank("id", self.id)
        require_non_blank("name", self.name)
