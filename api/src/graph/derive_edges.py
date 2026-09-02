"""Structural edges derived from entity fields.

One pure rule per entity field, per the SPEC API-contract table:
``Project.deposit_id`` -> DEVELOPS, operator ids -> OPERATES,
``parent_organization_id`` -> SUBSIDIARY_OF, facility outputs -> PRODUCES,
component/system ``requires`` -> REQUIRES (carrying the attested provenance).
"""

from collections.abc import Iterator, Mapping

from src.graph.types import DerivedEdge
from src.models import Component, Organization, ProcessingFacility, Project, System


def derive_edges(records: Mapping[str, tuple]) -> Iterator[DerivedEdge]:
    """Yield every structural edge implied by the given records, in stable order."""
    for project in records.get("projects", ()):
        yield from _project_edges(project)
    for facility in records.get("facilities", ()):
        yield from _facility_edges(facility)
    for organization in records.get("organizations", ()):
        yield from _organization_edges(organization)
    for component in records.get("components", ()):
        yield from _requires_edges(component)
    for system in records.get("systems", ()):
        yield from _requires_edges(system)


def _project_edges(project: Project) -> Iterator[DerivedEdge]:
    if project.deposit_id:
        yield DerivedEdge(
            id=f"drv-{project.id}-develops-{project.deposit_id}",
            type="DEVELOPS",
            from_id=project.id,
            to_id=project.deposit_id,
        )
    if project.operator_id:
        yield _operates(project.operator_id, project.id)


def _facility_edges(facility: ProcessingFacility) -> Iterator[DerivedEdge]:
    if facility.operator_id:
        yield _operates(facility.operator_id, facility.id)
    for material_id in facility.output_material_ids:
        yield DerivedEdge(
            id=f"drv-{facility.id}-produces-{material_id}",
            type="PRODUCES",
            from_id=facility.id,
            to_id=material_id,
        )


def _organization_edges(organization: Organization) -> Iterator[DerivedEdge]:
    if organization.parent_organization_id:
        yield DerivedEdge(
            id=f"drv-{organization.id}-subsidiary-of-{organization.parent_organization_id}",
            type="SUBSIDIARY_OF",
            from_id=organization.id,
            to_id=organization.parent_organization_id,
        )


def _requires_edges(owner: Component | System) -> Iterator[DerivedEdge]:
    for required in owner.requires:
        yield DerivedEdge(
            id=f"drv-{owner.id}-requires-{required.value}",
            type="REQUIRES",
            from_id=owner.id,
            to_id=required.value,
            provenance=required.provenance,
        )


def _operates(operator_id: str, asset_id: str) -> DerivedEdge:
    return DerivedEdge(
        id=f"drv-{operator_id}-operates-{asset_id}",
        type="OPERATES",
        from_id=operator_id,
        to_id=asset_id,
    )
