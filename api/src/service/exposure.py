"""Walks a mine's elements out to the components and platforms that need them.

Three hops, all of them already in the data model rather than in the edge
layers: a mine's ``products`` and ``planned_production`` name materials, a
``Component.requires`` names materials, and a ``Platform.requires`` names
components. Nothing here consults ``Relationship`` at all - the end-use side of
the chain has no assets, no locations and no tonnages, so none of the supply
adjacency applies to it.

Why the join is by element
--------------------------
A mine ships concentrate. A component needs separated oxide. ``mat-re-concentrate``
and ``mat-dy-oxide`` are different material ids and always will be, so joining on
id returns nothing for every mine in the graph. The elements are the only thing
the two ends share, which is why ``Material.elements`` carries them.

What that join licenses, and what it does not. It licenses: this mine's output
carries dysprosium, and this component cannot be built without dysprosium. It
does *not* license: this mine feeds this component. Nothing here checks that the
mine's Dy ever reaches a separator, that the separated oxide reaches a magnet
maker, or that any of it is contracted - ``src.disruption`` answers the first,
and the second has no edges in this graph at all. Read this as "what is at stake
in this element", not as a routed path.

Scope
-----
Dy and Tb, per ``graph.DYTB_ELEMENTS``. That scope is doing a lot of work: every
project in the current seed data carries both, so at this scope the platform
list is the same for every mine. That is a property of a Dy/Tb-scoped graph, not
a finding about any particular mine, and it is emitted as a warning rather than
left for a reader to mistake for differentiation. The mechanism does discriminate
- ``cmp-tb-green-phosphor`` needs Tb and ``cmp-dy-cermet-control-rod`` needs Dy,
so a Dy-only mine would reach one and not the other - the data just does not
exercise it yet.
"""

from src.graph import DYTB_ELEMENTS, SupplyGraph
from src.models import Component, Confidence, Platform, PlatformKind, Provenance, Source
from src.schemas import exposure as schemas

#: Weakest-link ordering for assertion confidence. ``None`` sorts last: an
#: assertion carrying no confidence is unrated, which is not the same as LOW,
#: but it cannot be allowed to outrank one that was actually rated.
_CONFIDENCE_RANK: dict[Confidence | None, int] = {
    Confidence.HIGH: 0,
    Confidence.MEDIUM: 1,
    Confidence.LOW: 2,
    None: 3,
}
_RANK_CONFIDENCE = {rank: conf for conf, rank in _CONFIDENCE_RANK.items()}

#: How specifically the source located the platform. A discrete airframe or hull
#: is a narrower claim than a whole class with no single platform behind it, so
#: it ranks above one. See ``Platform.kind`` - the distinction is recorded rather
#: than resolved, and collapsing it here would undo that.
_KIND_RANK: dict[PlatformKind, int] = {
    PlatformKind.PLATFORM: 0,
    PlatformKind.SUBSYSTEM: 1,
    PlatformKind.CATEGORY: 2,
}


def _provenance(prov: Provenance) -> schemas.Provenance:
    return schemas.Provenance(
        type=prov.type.value,
        source_id=prov.source_id,
        assertion_confidence=(
            prov.assertion_confidence.value if prov.assertion_confidence else None
        ),
        unverified_model_extraction=prov.unverified_model_extraction,
    )


def _source(source: Source) -> schemas.SourceRef:
    return schemas.SourceRef(
        id=source.id,
        name=source.name,
        source_type=source.source_type.value,
        publisher=source.publisher,
        published_on=source.published_on,
        url=source.url,
        locator=source.locator,
        source_confidence=(
            source.source_confidence.value if source.source_confidence else None
        ),
    )


def _cited_sources(
    graph: SupplyGraph, exposure: schemas.MineExposure
) -> list[schemas.SourceRef]:
    """Documents cited by ``exposure``, in order of first citation.

    Reads the assembled response rather than the graph, so nothing appears here
    that no row points at. An id naming no loaded source is skipped - a
    half-resolved citation is worse than none.
    """
    provenances = [
        *(m.provenance for m in exposure.source_materials),
        *(
            link.provenance
            for component in exposure.components
            for link in component.via_materials
        ),
        *(
            link.provenance
            for platform in exposure.platforms
            for link in platform.via_components
        ),
    ]
    out: list[schemas.SourceRef] = []
    seen: set[str] = set()
    for prov in provenances:
        source_id = prov.source_id if prov else None
        if source_id is None or source_id in seen:
            continue
        source = graph.sources.get(source_id)
        if source is None:
            continue
        seen.add(source_id)
        out.append(_source(source))
    return out


def _mine_materials(
    graph: SupplyGraph, mine_id: str, scope: frozenset[str]
) -> list[schemas.MineMaterial]:
    """Materials the mine's own disclosures name that carry a scoped element.

    Both ``products`` and ``planned_production`` are read, and the two are kept
    apart by ``shipped``. A product form is what the mine says it ships; a
    production figure is a tonnage, and for Dy and Tb it is often a split
    derived from a TREO distribution rather than a stream anybody sells. Mt Weld
    reports a Dy+Tb tonnage and ships mixed-phosphate concentrate, so treating
    the figure as a shipped oxide would invent a product.
    """
    project = graph.projects[mine_id]
    # Products first so a material named on both sides keeps shipped=True.
    entries = [(a.value.material_id, a.provenance, True) for a in project.products]
    entries += [
        (a.value.material_id, a.provenance, False) for a in project.planned_production
    ]

    out: list[schemas.MineMaterial] = []
    seen: set[str] = set()
    for material_id, prov, shipped in entries:
        if material_id in seen:
            continue
        material = graph.materials.get(material_id)
        if material is None:
            continue
        matched = scope & set(material.elements)
        if not matched:
            continue
        seen.add(material_id)
        out.append(
            schemas.MineMaterial(
                material_id=material_id,
                material_name=material.name,
                elements=list(material.elements),
                matched_elements=sorted(matched),
                provenance=_provenance(prov),
                shipped=shipped,
            )
        )
    return out


def _component_links(
    graph: SupplyGraph, component: Component, elements: frozenset[str]
) -> list[schemas.MaterialLink]:
    """The component's ``requires`` edges whose material carries one of ``elements``."""
    out: list[schemas.MaterialLink] = []
    for required in component.requires:
        material = graph.materials.get(required.value)
        if material is None:
            continue
        matched = elements & set(material.elements)
        if not matched:
            continue
        out.append(
            schemas.MaterialLink(
                material_id=material.id,
                material_name=material.name,
                elements=list(material.elements),
                matched_elements=sorted(matched),
                provenance=_provenance(required.provenance),
            )
        )
    return out


def _platform_paths(
    graph: SupplyGraph, reached: dict[str, schemas.ComponentExposure]
) -> dict[str, list[tuple[Platform, Component, Provenance]]]:
    """Every (platform, component, requires-provenance) triple the components reach."""
    out: dict[str, list[tuple[Platform, Component, Provenance]]] = {}
    for platform in graph.platforms.values():
        for required in platform.requires:
            component = graph.components.get(required.value)
            if component is None or component.id not in reached:
                continue
            out.setdefault(platform.id, []).append(
                (platform, component, required.provenance)
            )
    return out


def _path_confidence(edge: Provenance, component: schemas.ComponentExposure) -> int:
    """Weakest link over the two assertions this path rests on.

    The platform-requires-component edge and the strongest component-requires-
    material edge under it. Weakest link rather than a product: the two are not
    independent - several of these claims trace to the same publication - and
    the graph carries nothing that would justify combining them.
    """
    material_rank = min(
        (
            _CONFIDENCE_RANK[
                Confidence(link.provenance.assertion_confidence)
                if link.provenance and link.provenance.assertion_confidence
                else None
            ]
            for link in component.via_materials
        ),
        default=_CONFIDENCE_RANK[None],
    )
    edge_rank = _CONFIDENCE_RANK[edge.assertion_confidence]
    return max(edge_rank, material_rank)


def _scope_is_undiscriminating(graph: SupplyGraph, scope: frozenset[str]) -> bool:
    """Whether every project in the graph carries the same scoped elements.

    True means this result says nothing about *this* mine that it would not say
    about any other, which a reader comparing two alerts will otherwise take as
    a finding. Cheap: the graph holds a couple of dozen projects.
    """
    sets = set()
    for project in graph.projects.values():
        ids = {a.value.material_id for a in project.products}
        ids |= {a.value.material_id for a in project.planned_production}
        elements: set[str] = set()
        for material_id in ids:
            material = graph.materials.get(material_id)
            if material is not None:
                elements |= scope & set(material.elements)
        sets.add(frozenset(elements))
    return len(sets) == 1


def get_exposure(
    graph: SupplyGraph, mine_id: str, *, scope: frozenset[str] = DYTB_ELEMENTS
) -> schemas.MineExposure:
    """End uses reachable from ``mine_id``'s scoped elements.

    Raises ``KeyError`` where the id names no project; the router turns that
    into a 404.
    """
    project = graph.projects.get(mine_id)
    if project is None:
        raise KeyError(mine_id)

    source_materials = _mine_materials(graph, mine_id, scope)
    elements = frozenset(e for m in source_materials for e in m.matched_elements)
    warnings: list[str] = []

    if not elements:
        warnings.append(
            f"{mine_id} discloses no material carrying "
            f"{' or '.join(sorted(scope))}; nothing downstream is reached at this scope"
        )
        exposure = schemas.MineExposure(
            mine_id=mine_id,
            mine_name=project.name,
            scope_elements=sorted(scope),
            elements=[],
            source_materials=source_materials,
            warnings=warnings,
        )

    reached: dict[str, schemas.ComponentExposure] = {}
    for component in graph.components.values():
        links = _component_links(graph, component, elements)
        if not links:
            continue
        reached[component.id] = schemas.ComponentExposure(
            component_id=component.id,
            name=component.name,
            category=component.category,
            defense_relevant=component.defense_relevant,
            elements=sorted({e for link in links for e in link.matched_elements}),
            via_materials=links,
        )

    platforms: list[schemas.PlatformExposure] = []
    for platform_id, paths in _platform_paths(graph, reached).items():
        platform = paths[0][0]
        links = sorted(
            (
                schemas.ComponentLink(
                    component_id=component.id,
                    name=component.name,
                    defense_relevant=component.defense_relevant,
                    provenance=_provenance(edge),
                )
                for _, component, edge in paths
            ),
            key=lambda link: (
                _CONFIDENCE_RANK[
                    Confidence(link.provenance.assertion_confidence)
                    if link.provenance.assertion_confidence
                    else None
                ],
                link.component_id,
            ),
        )
        for _, component, _edge in paths:
            reached[component.id].platform_ids.append(platform_id)
        parent = graph.platforms.get(platform.parent_id) if platform.parent_id else None
        # Best path wins: a platform reached twice is as well evidenced as its
        # strongest route, not as weak as its worst.
        best = min(_path_confidence(edge, reached[c.id]) for _, c, edge in paths)
        platforms.append(
            schemas.PlatformExposure(
                platform_id=platform_id,
                name=platform.name,
                category=platform.category,
                kind=platform.kind.value,
                parent_id=platform.parent_id,
                parent_name=parent.name if parent else None,
                via_components=links,
                elements=sorted(
                    {e for _, c, _e in paths for e in reached[c.id].elements}
                ),
                confidence=(
                    _RANK_CONFIDENCE[best].value if _RANK_CONFIDENCE[best] else None
                ),
                defense_relevant=any(c.defense_relevant for _, c, _e in paths),
            )
        )

    platforms.sort(
        key=lambda p: (
            not p.defense_relevant,
            _KIND_RANK[PlatformKind(p.kind)],
            _CONFIDENCE_RANK[Confidence(p.confidence) if p.confidence else None],
            p.platform_id,
        )
    )
    # Reindex each component's platforms into the ranked order above, so the
    # two lists agree about which end use comes first.
    rank_of = {p.platform_id: i for i, p in enumerate(platforms)}
    for component in reached.values():
        component.platform_ids.sort(key=lambda pid: rank_of[pid])
    components = sorted(
        reached.values(), key=lambda c: (not c.defense_relevant, c.component_id)
    )

    if not platforms:
        warnings.append(
            f"{mine_id} carries {', '.join(sorted(elements))} but no modelled "
            "component requires it; the end-use layer is incomplete, not empty"
        )
    elif _scope_is_undiscriminating(graph, scope):
        warnings.append(
            f"every project in this graph carries the same "
            f"{'/'.join(sorted(scope))} elements, so this list is identical for "
            "every mine and does not distinguish between them"
        )

    exposure = schemas.MineExposure(
        mine_id=mine_id,
        mine_name=project.name,
        scope_elements=sorted(scope),
        elements=sorted(elements),
        source_materials=source_materials,
        components=components,
        platforms=platforms,
        warnings=warnings,
    )
    exposure.sources = _cited_sources(graph, exposure)
    return exposure
