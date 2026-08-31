"""Geographic and geopolitical context: coordinates and countries."""

import re
from dataclasses import dataclass

from src.models._validation import require_in_range, require_non_blank
from src.models.provenance import Attested

_ISO_ALPHA2 = re.compile(r"^[A-Z]{2}$")
_ISO_ALPHA3 = re.compile(r"^[A-Z]{3}$")


@dataclass(frozen=True)
class Coordinates:
    """A WGS84 point location."""

    latitude: float
    longitude: float

    def __post_init__(self) -> None:
        require_in_range("latitude", self.latitude, -90.0, 90.0)
        require_in_range("longitude", self.longitude, -180.0, 180.0)


@dataclass(frozen=True)
class Country:
    """A geopolitical jurisdiction.

    Alignment and risk are *attested* rather than fixed: they are judgments or
    model outputs with their own provenance, not permanent categorical truths.
    """

    id: str
    name: str
    iso_alpha2: str
    iso_alpha3: str | None = None
    #: Boundary geometry as WKT, if loaded.
    geometry_wkt: str | None = None
    #: e.g. "ALLY", "PARTNER", "NEUTRAL", "ADVERSARY" — sourced or judged.
    alignment: Attested[str] | None = None
    #: Geopolitical supply risk in [0, 1] — typically a model estimate.
    risk_score: Attested[float] | None = None

    def __post_init__(self) -> None:
        require_non_blank("id", self.id)
        require_non_blank("name", self.name)
        if not _ISO_ALPHA2.match(self.iso_alpha2):
            raise ValueError(f"iso_alpha2 must be two uppercase letters, got {self.iso_alpha2!r}")
        if self.iso_alpha3 is not None and not _ISO_ALPHA3.match(self.iso_alpha3):
            raise ValueError(f"iso_alpha3 must be three uppercase letters, got {self.iso_alpha3!r}")
        if self.risk_score is not None:
            require_in_range("risk_score", self.risk_score.value, 0.0, 1.0)
