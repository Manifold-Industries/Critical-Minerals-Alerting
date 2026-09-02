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


# ── Source attribution ──────────────────────────────────────────────────────
#
# A bare source_id is not attribution: nothing downstream can turn
# "src-iluka-ar25-2025" into a document a reader can check. These pin that the
# response resolves what it cites, cites only what a row rests on, and keeps
# the two confidences apart.


def _provenances(body: dict) -> list[dict]:
    """Every provenance on the response, in the order sources are collected."""
    return [
        p
        for p in (
            body["operating_status_provenance"],
            body["development_stage_provenance"],
            body["expected_start_provenance"],
            *(f["provenance"] for f in body["figures"]),
            *(f["provenance"] for f in body["accepted_feeds"]),
            *(p["provenance"] for p in body["products"]),
            *(link["provenance"] for link in body["supplied_by"]),
            *(link["provenance"] for link in body["supplies_to"]),
        )
        if p is not None
    ]


def test_every_cited_source_is_resolved_to_a_document(client: TestClient) -> None:
    body = client.get("/assets/fac-lynas-malaysia").json()
    cited = {p["source_id"] for p in _provenances(body) if p["source_id"]}
    resolved = {s["id"] for s in body["sources"]}
    assert cited and cited == resolved
    assert all(s["name"] and s["source_type"] for s in body["sources"])


def test_no_source_appears_that_no_row_points_at(client: TestClient) -> None:
    """Padding the list with documents merely mentioning the asset would imply
    support no row is claiming."""
    body = client.get("/assets/fac-lynas-malaysia").json()
    cited = {p["source_id"] for p in _provenances(body) if p["source_id"]}
    assert [s["id"] for s in body["sources"] if s["id"] not in cited] == []


def test_sources_are_in_order_of_first_citation(client: TestClient) -> None:
    """The order is the only thing tying a row to its entry, so it is the contract."""
    body = client.get("/assets/fac-lynas-malaysia").json()
    first_seen: list[str] = []
    for prov in _provenances(body):
        sid = prov["source_id"]
        if sid and sid not in first_seen:
            first_seen.append(sid)
    assert [s["id"] for s in body["sources"]] == first_seen


def test_an_assertion_needing_no_document_contributes_no_source(
    client: TestClient,
) -> None:
    """Lynas Malaysia carries a JUDGMENT edge with no source behind it."""
    body = client.get("/assets/fac-lynas-malaysia").json()
    links = body["supplied_by"] + body["supplies_to"]
    judgments = [l for l in links if l["provenance"]["type"] == "JUDGMENT"]
    assert judgments and all(l["provenance"]["source_id"] is None for l in judgments)
    assert len(body["sources"]) < len(_provenances(body))


def test_an_unanchored_source_is_returned_with_a_null_url(client: TestClient) -> None:
    """Fingerboards cites disclosures with no retrievable location.

    Returned rather than dropped - the claim does rest on something - but a
    client must not render a link for it.
    """
    body = client.get("/assets/proj-fingerboards").json()
    by_id = {s["id"]: s for s in body["sources"]}
    assert by_id["src-gcm-fingerboards-disclosures"]["url"] is None


def test_source_confidence_is_kept_apart_from_assertion_confidence(
    client: TestClient,
) -> None:
    """A high-confidence reading of a weak document is not a strong claim."""
    body = client.get("/assets/fac-lynas-malaysia").json()
    assert all("source_confidence" in s for s in body["sources"])
    assert all("assertion_confidence" in p for p in _provenances(body))


def test_citations_say_that_nobody_has_checked_them(client: TestClient) -> None:
    """Every assertion in the seed data is an unverified model extraction.

    Presenting a citation without this implies a verification that has not
    happened, so the flag has to survive the API rather than default in.
    """
    body = client.get("/assets/fac-lynas-malaysia").json()
    assert all(p["unverified_model_extraction"] is True for p in _provenances(body))


def test_the_locator_survives_so_a_long_report_stays_checkable(
    client: TestClient,
) -> None:
    body = client.get("/assets/proj-donald").json()
    assert any(s["locator"] for s in body["sources"])
