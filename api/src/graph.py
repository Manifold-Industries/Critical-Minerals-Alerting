"""Loaded supply graph with the adjacency indexes traversal needs.

``build()`` in ``scripts/validate_data.py`` turns the seed JSON into dataclasses;
this wraps that output in the lookups a query actually wants, so callers stop
rescanning a few hundred relationships per hop. Construct it once and share it.

The two edge layers stay separate all the way through, exactly as they are on
disk. ``curated`` carries evidence about a specific pair; ``inferred`` carries
only the observation that two declared forms line up, and says so in its own
provenance. Merging them here would quietly discard the distinction that
``scripts/generate_inferred_routes.py`` exists to preserve.
"""

from dataclasses import dataclass, field

from src.models import (
    Coordinates,
    Country,
    Deposit,
    Material,
    Organization,
    ProcessingFacility,
    Project,
    Relationship,
    RelationshipType,
)

#: Elements this graph is scoped to. A material counts as a dedicated Dy/Tb
#: stream when it carries nothing else - which is what separates ``mat-dy-oxide``
#: and ``mat-hreo`` from ``mat-mrec``, whose Dy and Tb ride along with Nd and Pr.
DYTB_ELEMENTS = frozenset({"Dy", "Tb"})


def _index(edges: tuple[Relationship, ...], key: str) -> dict[str, tuple[Relationship, ...]]:
    out: dict[str, list[Relationship]] = {}
    for edge in edges:
        node = getattr(edge, key)
        if node is not None:
            out.setdefault(node, []).append(edge)
    return {k: tuple(v) for k, v in out.items()}


@dataclass(frozen=True)
class SupplyGraph:
    """Entities by id, plus forward and reverse adjacency over the edge layers."""

    projects: dict[str, Project]
    facilities: dict[str, ProcessingFacility]
    #: Held for location only: a Project has no coordinates of its own and
    #: reaches one through ``deposit_id``. See ``coordinates_of``.
    deposits: dict[str, Deposit]
    organizations: dict[str, Organization]
    countries: dict[str, Country]
    materials: dict[str, Material]
    curated: tuple[Relationship, ...]
    inferred: tuple[Relationship, ...]
    #: Edges dropped for naming a node this graph does not hold. See ``from_data``.
    dangling: tuple[Relationship, ...] = ()
    supplies_from: dict[str, tuple[Relationship, ...]] = field(default_factory=dict)
    supplies_to: dict[str, tuple[Relationship, ...]] = field(default_factory=dict)
    can_supply_to: dict[str, tuple[Relationship, ...]] = field(default_factory=dict)
    inferred_to: dict[str, tuple[Relationship, ...]] = field(default_factory=dict)

    @classmethod
    def from_data(cls, data: dict[str, list]) -> "SupplyGraph":
        """Wrap the output of ``scripts.validate_data.build()``.

        Commented-out records never reach here as *nodes* - ``load()`` drops any
        record carrying ``_commented_out`` while reading the seed files, so the
        dicts below are already the loaded subset. Edges are the loose end: an
        edge is its own record, so commenting out a facility leaves behind every
        edge that named it, now pointing at a node this graph does not hold.

        Those are pruned once, here, rather than guarded at each hop, and kept in
        ``dangling`` so a half-finished scoping edit is visible rather than a
        quietly smaller reroute set. ``validate_data.py`` still reports them as
        errors - this is not a substitute for that, it stops a graph built from
        mid-edit data from ranking a route through a plant it cannot describe.
        """
        projects = {p.id: p for p in data["projects"]}
        facilities = {f.id: f for f in data["facilities"]}
        deposits = {d.id: d for d in data["deposits"]}
        organizations = {o.id: o for o in data["organizations"]}
        loaded = projects.keys() | facilities.keys() | organizations.keys()

        def resolved(edge: Relationship) -> bool:
            # to_id is None on UNRESOLVED edges: counterparty unknown, not missing.
            return edge.from_id in loaded and (edge.to_id is None or edge.to_id in loaded)

        both = (*data["relationships"], *data["relationships_inferred"])
        curated = tuple(r for r in data["relationships"] if resolved(r))
        inferred = tuple(r for r in data["relationships_inferred"] if resolved(r))
        supplies = tuple(r for r in curated if r.type is RelationshipType.SUPPLIES)
        can_supply = tuple(r for r in curated if r.type is RelationshipType.CAN_SUPPLY)
        return cls(
            projects=projects,
            facilities=facilities,
            deposits=deposits,
            organizations=organizations,
            countries={c.id: c for c in data["countries"]},
            materials={m.id: m for m in data["materials"]},
            curated=curated,
            inferred=inferred,
            dangling=tuple(r for r in both if not resolved(r)),
            supplies_from=_index(supplies, "from_id"),
            supplies_to=_index(supplies, "to_id"),
            can_supply_to=_index(can_supply, "to_id"),
            inferred_to=_index(inferred, "to_id"),
        )

    def is_asset(self, node_id: str | None) -> bool:
        """Whether an id names a physical asset rather than an organization."""
        return node_id in self.projects or node_id in self.facilities

    def coordinates_of(self, node_id: str) -> Coordinates | None:
        """Point location for an asset, or ``None`` where none is recorded.

        A facility carries its own coordinates. A project does not - ``Project``
        has no such field, so location is reached through ``deposit_id``, and a
        project with no deposit has no location at all. Callers that plot this
        must handle the null rather than substituting a country centroid, which
        would put two plants in one country on the same point.
        """
        facility = self.facilities.get(node_id)
        if facility is not None:
            return facility.coordinates.value if facility.coordinates else None
        project = self.projects.get(node_id)
        if project is None or project.deposit_id is None:
            return None
        deposit = self.deposits.get(project.deposit_id)
        return deposit.coordinates.value if deposit and deposit.coordinates else None

    def name_of(self, node_id: str) -> str | None:
        node = self.projects.get(node_id) or self.facilities.get(node_id)
        return node.name if node else None

    def country_of(self, node_id: str) -> str | None:
        node = self.projects.get(node_id) or self.facilities.get(node_id)
        return node.country_id if node else None

    def alignment_of(self, node_id: str) -> str | None:
        """Country alignment for an asset, or ``None`` where unassessed.

        ``Country.alignment`` is an ``Attested[str]``: every value in the seed data
        is a ``JUDGMENT`` with no source behind it, and Malawi carries none at all.
        Callers that rank on this must handle the null rather than reading it as a
        low score - see ``disruption.ALIGNMENT_RANK``.
        """
        country_id = self.country_of(node_id)
        country = self.countries.get(country_id) if country_id else None
        if country is None or country.alignment is None:
            return None
        return country.alignment.value

    @property
    def dytb_material_ids(self) -> frozenset[str]:
        """Materials that are Dy/Tb and nothing else.

        Membership is by element, not by id or category: ``mat-separated-reo`` and
        ``mat-mrec`` both contain Dy and Tb but carry Nd and Pr too, so neither is
        evidence that a plant runs a Dy/Tb separation circuit.
        """
        return frozenset(
            m.id
            for m in self.materials.values()
            if m.elements and set(m.elements) <= DYTB_ELEMENTS
        )

    def is_dytb_refiner(self, facility_id: str) -> bool:
        """Whether a plant ships a dedicated Dy/Tb stream."""
        facility = self.facilities.get(facility_id)
        if facility is None:
            return False
        return bool(set(facility.output_material_ids) & self.dytb_material_ids)
