"""Material: a physical material at a particular stage of the supply chain."""

from dataclasses import dataclass
from enum import StrEnum

from src.models._validation import require_non_blank


class HostMineral(StrEnum):
    """The mineral or physical host a rare-earth feed arrives in.

    ``MaterialCategory`` says how far along the chain a stream is; this says what
    a plant has to *do* to it. The distinction is the whole reason category alone
    cannot decide compatibility: monazite and xenotime are both ``CONCENTRATE``
    and differ in acid consumption, cracking temperature and radionuclide
    handling, while an ion-adsorbed clay stream skips cracking altogether.

    Recorded on the feed, not on the ``Material``, because one material id is
    legitimately shipped in several hosts - ``mat-re-concentrate`` covers
    Mountain Pass bastnaesite and Wimmera monazite/xenotime alike.
    """

    #: Y/HREE-rich phosphate. Hardest to crack, highest acid demand.
    XENOTIME = "XENOTIME"
    #: LREE phosphate. Cracks readily; carries thorium.
    MONAZITE = "MONAZITE"
    #: LREE fluorocarbonate. Roast/leach, no phosphate circuit.
    BASTNAESITE = "BASTNAESITE"
    #: Monazite/xenotime blends where the split is not separately disclosed.
    MIXED_PHOSPHATE = "MIXED_PHOSPHATE"
    #: Ion-adsorption clay. Desorbed with a salt leach; no cracking circuit at all.
    ION_ADSORBED = "ION_ADSORBED"
    #: End-of-life magnets and swarf.
    RECYCLED_MAGNET = "RECYCLED_MAGNET"
    #: Bulk mineral-sands stream still to be separated into its mineral phases.
    UNSEPARATED_SANDS = "UNSEPARATED_SANDS"
    #: Already cracked - carbonates, oxides, metals. Host no longer constrains the route.
    CRACKED = "CRACKED"
    #: Shipped form is known but its mineral host is not publicly stated. Never
    #: treat as a wildcard: an undisclosed host cannot clear a narrowed envelope,
    #: so it degrades a route to PLAUSIBLE rather than silently qualifying it.
    UNDISCLOSED = "UNDISCLOSED"


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
