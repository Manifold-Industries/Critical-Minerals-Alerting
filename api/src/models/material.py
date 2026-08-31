"""Material: a physical material at a particular stage of the supply chain."""

from dataclasses import dataclass
from enum import StrEnum

from src.models._validation import require_non_blank


class MaterialCategory(StrEnum):
    ORE = "ORE"
    CONCENTRATE = "CONCENTRATE"
    CARBONATE = "CARBONATE"
    OXIDE = "OXIDE"
    METAL = "METAL"
    ALLOY = "ALLOY"
    MAGNET = "MAGNET"


@dataclass(frozen=True)
class Material:
    id: str
    name: str
    category: MaterialCategory
    #: Constituent element symbols, e.g. ("Dy", "Tb").
    elements: tuple[str, ...] = ()
    unit: str = "t"

    def __post_init__(self) -> None:
        require_non_blank("id", self.id)
        require_non_blank("name", self.name)
