"""Pydantic response models for mine end-use exposure.

What this layer asserts, and what it does not
---------------------------------------------
Every edge behind these models is an open-source claim that a platform *class*
uses a component *class*, and that a component class needs a material. Bills of
material are classified; nothing here says metal from a particular mine reached
a particular airframe, and a client that presents it that way is overstating the
evidence. ``Platform.kind`` carries how specifically the source located the
claim - a named airframe, a named subsystem of one, or a whole class with no
single hull behind it - and is passed through rather than flattened.

The join is by *element*, not by material id. A mine ships concentrate; a
component needs separated oxide. ``mat-re-concentrate`` and ``mat-dy-oxide``
share no id and never will, so matching ids would return nothing at all for
every mine in the graph. See ``src/service/exposure.py`` for the traversal and
for what the element join does and does not license.
"""

from pydantic import BaseModel, Field

from src.schemas.assets import SourceRef


class Provenance(BaseModel):
    type: str
    source_id: str | None = None
    assertion_confidence: str | None = None
    #: See ``schemas.disruption.Provenance`` - nothing here is human-verified.
    unverified_model_extraction: bool = True


class MaterialLink(BaseModel):
    """One material, and the scoped elements it carries into the join."""

    material_id: str
    material_name: str | None = None
    #: Every element the material carries, not only the scoped ones.
    elements: list[str] = []
    #: The subset of ``elements`` inside the requested scope. This, not
    #: ``elements``, is what actually made the link.
    matched_elements: list[str] = []
    #: Provenance of the assertion that put this material here - the
    #: ``requires`` edge on a component, the mine's own disclosure on a
    #: ``MineMaterial``.
    provenance: Provenance | None = None


class MineMaterial(MaterialLink):
    """A material named by the mine's own disclosures."""

    #: True where the mine declares this as a form it *ships*. False where the
    #: material appears only as a production figure - a contained-element
    #: disclosure, which for Dy and Tb is frequently a derived split rather
    #: than a shipped product. Mt Weld reports a Dy+Tb tonnage and ships
    #: concentrate; reading the first as a shipped oxide would be wrong.
    shipped: bool


class ComponentExposure(BaseModel):
    """A component class reached from the mine, and the material that reached it."""

    component_id: str
    name: str
    category: str
    defense_relevant: bool
    #: Scoped elements this component is reached by, via ``requires``.
    elements: list[str] = []
    #: The component's own material requirements that carry those elements,
    #: each with the provenance of that ``requires`` assertion.
    via_materials: list[MaterialLink] = []
    #: Platforms reached through this component.
    platform_ids: list[str] = []


class ComponentLink(BaseModel):
    """A component as seen from a platform that requires it."""

    component_id: str
    name: str
    defense_relevant: bool
    #: Provenance of the platform's ``requires`` assertion, not the component's.
    provenance: Provenance


class PlatformExposure(BaseModel):
    """A platform class reached from the mine through at least one component."""

    platform_id: str
    name: str
    category: str
    #: PLATFORM, SUBSYSTEM or CATEGORY. A CATEGORY names no single hull or
    #: airframe; presenting it beside a named platform without this reads as a
    #: more specific claim than the source made.
    kind: str
    #: Set only on a SUBSYSTEM, where the source names the platform it belongs
    #: to. The parent is *not* itself reported as exposed on that basis: the
    #: graph carries no assertion that losing a subsystem stops the parent.
    parent_id: str | None = None
    parent_name: str | None = None
    #: Components through which this platform is reached, best-evidenced
    #: ``requires`` assertion first, then by id.
    via_components: list[ComponentLink] = []
    #: Scoped elements reaching this platform, across every component above.
    elements: list[str] = []
    #: Weakest link on the two-edge path actually used (platform-requires-
    #: component, component-requires-material), taking the strongest path where
    #: several reach the same platform. The weakest link, not a joint
    #: probability - the assertions are not independent and the graph carries
    #: nothing that would let them be combined.
    #:
    #: A link is no stronger than the document under it, so each edge is graded
    #: at the weaker of its own ``assertion_confidence`` and the
    #: ``source_confidence`` of the source it cites. A confident reading of a
    #: weak document is not a strong claim, and grading the path on assertions
    #: alone said it was: of the 21 ``requires`` edges in the current data, 10
    #: are weaker once their document is counted, and every component edge is
    #: asserted HIGH while the documents behind them are not.
    confidence: str | None = None
    #: True where at least one component on the path is flagged defense
    #: relevant. Ordering criterion 1.
    defense_relevant: bool = False


class MineExposure(BaseModel):
    """End uses reachable from one mine's scoped elements.

    Ordering of ``platforms`` is lexicographic over four criteria, applied in
    this order: defence relevance, then how specifically the source located the
    platform (PLATFORM, SUBSYSTEM, CATEGORY), then the weakest-link confidence,
    then the id as a deterministic tiebreak. Every field it sorts on is carried
    on ``PlatformExposure``, so the order can be read back. There is no score:
    the criteria are ordinal and no exchange rate between them exists.
    """

    mine_id: str
    mine_name: str | None = None
    #: Elements the traversal was scoped to, e.g. ["Dy", "Tb"].
    scope_elements: list[str] = []
    #: Scoped elements this mine's own disclosures actually name. A mine outside
    #: the scope entirely returns this empty, with no components or platforms.
    elements: list[str] = []
    #: The mine's materials that carry those elements. Read ``shipped``.
    source_materials: list[MineMaterial] = []
    components: list[ComponentExposure] = []
    platforms: list[PlatformExposure] = Field(
        default=[],
        description="Reachable end uses, most specific and best evidenced first",
    )
    #: Every document cited by a ``provenance`` above, in order of first
    #: citation. Without it ``source_id`` is a bare string: nothing downstream
    #: can turn ``src-crs-rare-earths-2025`` into something a reader can check,
    #: and ``confidence`` is graded partly on documents the caller cannot see.
    sources: list[SourceRef] = []
    #: Conditions the caller should surface rather than swallow.
    warnings: list[str] = []
