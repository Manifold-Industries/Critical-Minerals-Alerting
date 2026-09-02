"""Platform: an end system, subsystem, or system class that depends on components.

Replaces the earlier ``System``. Dependencies are *functional* — the platform
needs the component class — not claims that material from a particular mine
reached a particular unit. Bills of material are classified; every edge here is
an open-source assertion that a platform class uses a component class, and it is
only ever that.

``kind`` exists because the open-source record does not name platforms at one
level. Some claims attach to a discrete platform ("F-35 Lightning II"), some to
a named subsystem of one ("Virginia-class submarine sonar"), and some to a whole
class with no single airframe or hull behind it ("hypersonic missile systems").
Flattening the three would make the graph look more precise than the evidence is,
so the distinction is recorded rather than resolved. A ``SUBSYSTEM`` may name its
``parent_id``; a ``CATEGORY`` deliberately cannot, because there is no one parent
to name.
"""

from dataclasses import dataclass
from enum import StrEnum

from src.models._validation import require_non_blank
from src.models.provenance import Attested


class PlatformKind(StrEnum):
    """How specifically the source located the dependency."""

    #: A discrete end system: an airframe, hull, or munition class.
    PLATFORM = "PLATFORM"
    #: A named subsystem of a specific platform. May set ``parent_id``.
    SUBSYSTEM = "SUBSYSTEM"
    #: A class of systems rather than one of them - no single platform to point at.
    CATEGORY = "CATEGORY"


@dataclass(frozen=True)
class Platform:
    id: str
    name: str
    category: str
    kind: PlatformKind
    #: Component ids this platform requires, each with provenance. Empty is
    #: meaningful: a hull whose only modelled dependency runs through a subsystem.
    requires: tuple[Attested[str], ...] = ()
    #: Platform this is a subsystem of, where the source names one.
    parent_id: str | None = None
    operator: str | None = None

    def __post_init__(self) -> None:
        require_non_blank("id", self.id)
        require_non_blank("name", self.name)
        if self.parent_id is not None and self.kind is not PlatformKind.SUBSYSTEM:
            raise ValueError(
                f"{self.id}: parent_id is only meaningful for SUBSYSTEM, got {self.kind.value}"
            )
