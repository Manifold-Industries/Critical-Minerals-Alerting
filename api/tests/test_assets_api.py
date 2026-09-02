"""Endpoint tests for per-asset reference detail.

The contract that matters here is that nothing is silently collapsed: the
disruption service combines and supersedes figures for ranking, and this view
exists precisely to show what that collapsing hid.
"""

import pytest
from fastapi.testclient import TestClient

from src.main import app


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def test_unknown_asset_is_404(client: TestClient) -> None:
    assert client.get("/assets/not-an-asset").status_code == 404


def test_facility_reports_every_staged_capacity_not_the_one_in_force(
    client: TestClient,
) -> None:
    """White Mesa holds Dy at 120 t (2027) and 288 t (2029) for the same circuit."""
    body = client.get("/assets/fac-white-mesa").json()
    dy = [f for f in body["figures"] if f["material_id"] == "mat-dy-oxide"]
    assert {(f["tonnes"], f["target_year"]) for f in dy} == {(120, 2027), (288, 2029)}


def test_superseded_rows_are_marked_so_nothing_sums_them(client: TestClient) -> None:
    """Later entries replace earlier ones; adding them would overstate capacity."""
    body = client.get("/assets/fac-white-mesa").json()
    by_year = {
        (f["material_id"], f["target_year"]): f["superseded_by"] for f in body["figures"]
    }
    assert by_year[("mat-dy-oxide", 2027)] == 2029
    assert by_year[("mat-dy-oxide", 2029)] is None


def test_undated_figures_are_never_superseded(client: TestClient) -> None:
    """A figure with no target year is always in force."""
    body = client.get("/assets/proj-donald").json()
    undated = [f for f in body["figures"] if f["target_year"] is None]
    assert undated and all(f["superseded_by"] is None for f in undated)


def test_mine_carries_stage_deposit_and_element_figures(client: TestClient) -> None:
    body = client.get("/assets/proj-donald").json()
    assert body["kind"] == "MINE"
    assert body["development_stage"] == "FEASIBILITY"
    assert body["expected_start"] == 2028
    assert body["deposit"]["id"] == "dep-donald"
    materials = {f["material_id"] for f in body["figures"]}
    # The combined figure and the split it was derived from both survive here.
    assert {"mat-dytb-combined", "mat-dy-oxide", "mat-tb-oxide"} <= materials


def test_figures_carry_their_own_provenance_and_note(client: TestClient) -> None:
    """A tonnage without what it rests on is not usable as reference."""
    body = client.get("/assets/proj-donald").json()
    for figure in body["figures"]:
        assert figure["provenance"]["type"]
    assert any(f["note"] for f in body["figures"])


def test_facility_reports_feed_envelope_with_host_constraints(client: TestClient) -> None:
    body = client.get("/assets/fac-white-mesa").json()
    hosts = {h for f in body["accepted_feeds"] for h in f["accepted_hosts"]}
    assert "MONAZITE" in hosts


def test_edges_are_curated_only_and_flag_inference(client: TestClient) -> None:
    """The generated layer is 218 rows that state they are not evidence."""
    body = client.get("/assets/fac-white-mesa").json()
    assert body["supplied_by"], "White Mesa has curated inbound edges"
    assert all(link["inferred"] is False for link in body["supplied_by"])


def test_mine_resolves_coordinates_through_its_deposit(client: TestClient) -> None:
    """Project has no coordinates field; location comes via deposit_id."""
    body = client.get("/assets/proj-mount-weld").json()
    assert body["coordinates"] is not None
    assert body["kind"] == "MINE"
