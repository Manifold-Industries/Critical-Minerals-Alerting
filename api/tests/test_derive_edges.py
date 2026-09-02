"""Unit tests for the structural-edge derivation rules, on a hand-built fixture."""

from src.graph.derive_edges import derive_edges
from src.models import (
    Attested,
    Component,
    DevelopmentStage,
    FacilityType,
    OperatingStatus,
    Organization,
    OrganizationType,
    ProcessingFacility,
    Project,
    Provenance,
    ProvenanceType,
    System,
)

PROV = Provenance(type=ProvenanceType.JUDGMENT)


def _att(value: object) -> Attested:
    return Attested(value, PROV)


RECORDS = {
    "projects": (
        Project(
            id="proj-a",
            name="Project A",
            country_id="AU",
            development_stage=_att(DevelopmentStage.PRODUCTION),
            operating_status=_att(OperatingStatus.OPERATING),
            deposit_id="dep-a",
            operator_id="org-a",
        ),
    ),
    "facilities": (
        ProcessingFacility(
            id="fac-a",
            name="Facility A",
            facility_type=FacilityType.REFINERY,
            country_id="AU",
            operating_status=_att(OperatingStatus.OPERATING),
            operator_id="org-a",
            output_material_ids=("mat-x", "mat-y"),
        ),
    ),
    "organizations": (
        Organization(
            id="org-b",
            name="Org B",
            organization_type=OrganizationType.COMPANY,
            parent_organization_id="org-a",
        ),
    ),
    "components": (Component(id="cmp-a", name="Cmp A", category="magnet", requires=(_att("mat-x"),)),),
    "systems": (System(id="sys-a", name="Sys A", category="aircraft", requires=(_att("cmp-a"),)),),
}


def test_every_rule_produces_its_edges_and_nothing_else() -> None:
    edges = list(derive_edges(RECORDS))
    assert {(e.type, e.from_id, e.to_id) for e in edges} == {
        ("DEVELOPS", "proj-a", "dep-a"),
        ("OPERATES", "org-a", "proj-a"),
        ("OPERATES", "org-a", "fac-a"),
        ("SUBSIDIARY_OF", "org-b", "org-a"),
        ("PRODUCES", "fac-a", "mat-x"),
        ("PRODUCES", "fac-a", "mat-y"),
        ("REQUIRES", "cmp-a", "mat-x"),
        ("REQUIRES", "sys-a", "cmp-a"),
    }
    assert len(edges) == len({e.id for e in edges}), "edge ids must be unique"


def test_requires_edges_carry_the_attested_provenance_others_none() -> None:
    by_type = {}
    for edge in derive_edges(RECORDS):
        by_type.setdefault(edge.type, edge)
    assert by_type["REQUIRES"].provenance == PROV
    assert by_type["DEVELOPS"].provenance is None
    assert by_type["PRODUCES"].provenance is None
