"""Types shared by the graph-assembly modules."""

from dataclasses import dataclass

from src.models import Provenance

#: Record kinds that appear as graph nodes, mapped to their singular label.
#: Countries and sources are context, relationships are edges.
NODE_KINDS: dict[str, str] = {
    "deposits": "deposit",
    "organizations": "organization",
    "projects": "project",
    "facilities": "facility",
    "materials": "material",
    "components": "component",
    "systems": "system",
}


@dataclass(frozen=True)
class DerivedEdge:
    """A structural edge implied by an entity field rather than a Relationship.

    ``provenance`` is carried across only when the source field is Attested
    (component/system ``requires``); plain id fields have none of their own.
    """

    id: str
    type: str
    from_id: str
    to_id: str
    provenance: Provenance | None = None
