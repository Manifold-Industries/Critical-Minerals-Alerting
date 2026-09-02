"""Endpoint tests for the disruption API.

These pin the contract the console depends on, not the ranking itself - that is
covered by ``test_disruption.py``. What matters here is that the shape survives
serialisation: the caveat fields stay on the wire, the traversed path comes back
whole, and a bad request fails with a status rather than a 500.
"""

import pytest
from fastapi.testclient import TestClient

from src.main import app


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def test_unknown_mine_is_404(client: TestClient) -> None:
    assert client.get("/disruption/proj-nonexistent").status_code == 404


def test_severity_outside_range_is_422(client: TestClient) -> None:
    assert client.get("/disruption/proj-mount-weld", params={"severity": 1.5}).status_code == 422


def test_two_hop_path_includes_the_intermediate(client: TestClient) -> None:
    """Mt Weld reaches Lynas Malaysia only through Kalgoorlie; the path must show it."""
    body = client.get("/disruption/proj-mount-weld", params={"as_of_year": 2027}).json()
    hit = next(i for i in body["impacted"] if i["facility_id"] == "fac-lynas-malaysia")
    assert hit["hops"] == 2
    assert [n["id"] for n in hit["path"]] == [
        "proj-mount-weld",
        "fac-lynas-kalgoorlie",
        "fac-lynas-malaysia",
    ]


def test_every_plotted_node_carries_coordinates(client: TestClient) -> None:
    """The console cannot render a node without a point, so this is a hard contract."""
    body = client.get("/disruption/proj-caldeira", params={"as_of_year": 2027}).json()
    assert body["coordinates"] is not None
    for impact in body["impacted"]:
        assert impact["coordinates"] is not None
        for node in impact["path"]:
            assert node["coordinates"] is not None


def test_caveat_fields_survive_serialisation(client: TestClient) -> None:
    """The ranking is not interpretable without these, so they must reach the client."""
    body = client.get("/disruption/proj-donald", params={"as_of_year": 2027, "limit": 5}).json()
    alt = body["impacted"][0]["alternatives"][0]
    for field in (
        "evidence_class",
        "basis_comparable",
        "readiness_known",
        "alignment_known",
        "already_committed_to",
        "note",
    ):
        assert field in alt


def test_limit_caps_alternatives_keeping_the_best(client: TestClient) -> None:
    params = {"as_of_year": 2027, "limit": 3}
    capped = client.get("/disruption/proj-mountain-pass", params=params).json()
    full = client.get("/disruption/proj-mountain-pass", params={"as_of_year": 2027}).json()
    capped_alts = capped["impacted"][0]["alternatives"]
    assert len(capped_alts) == 3
    assert [a["source_id"] for a in capped_alts] == [
        a["source_id"] for a in full["impacted"][0]["alternatives"][:3]
    ]
    assert [a["rank"] for a in capped_alts] == [1, 2, 3]


def test_min_qualification_prunes_the_reroute_space(client: TestClient) -> None:
    base = client.get("/disruption/proj-donald", params={"as_of_year": 2027}).json()
    pruned = client.get(
        "/disruption/proj-donald",
        params={"as_of_year": 2027, "min_qualification": "FEED_ENVELOPE"},
    ).json()
    assert len(pruned["impacted"][0]["alternatives"]) < len(base["impacted"][0]["alternatives"])


def test_mines_listing_flags_downstream_reach(client: TestClient) -> None:
    mines = client.get("/disruption/mines", params={"as_of_year": 2027}).json()
    assert any(m["reaches_refiner"] for m in mines)
    reaching = client.get(
        "/disruption/mines", params={"as_of_year": 2027, "reaches_refiner": True}
    ).json()
    assert all(m["reaches_refiner"] for m in reaching)
    assert {m["mine_id"] for m in reaching} <= {m["mine_id"] for m in mines}


def test_year_range_is_derived_from_the_data(client: TestClient) -> None:
    body = client.get("/disruption/years").json()
    assert body["min_year"] < body["max_year"]
    assert body["min_year"] <= body["default_year"] <= body["max_year"]


def test_years_is_not_swallowed_by_the_mine_id_route(client: TestClient) -> None:
    """`/years` is declared first; without that it would resolve as a mine id."""
    assert client.get("/disruption/years").status_code == 200
    assert set(client.get("/disruption/years").json()) == {
        "min_year",
        "max_year",
        "default_year",
    }


def test_simulating_before_a_mine_opens_is_flagged_not_refused(client: TestClient) -> None:
    """Caldeira does not produce until 2029, so 2027 is answerable but misleading."""
    early = client.get("/disruption/proj-caldeira", params={"as_of_year": 2027}).json()
    assert early["earliest_year"] == 2029
    assert early["before_production_start"] is True
    assert "does not exist yet" in early["warnings"][0]

    on_time = client.get("/disruption/proj-caldeira", params={"as_of_year": 2029}).json()
    assert on_time["before_production_start"] is False


def test_operating_mine_has_no_lower_bound(client: TestClient) -> None:
    """Mt Weld is already producing, so it carries no expected start to bound on."""
    body = client.get("/disruption/proj-mount-weld", params={"as_of_year": 2025}).json()
    assert body["earliest_year"] is None
    assert body["before_production_start"] is False


def test_mines_listing_carries_the_lower_bound(client: TestClient) -> None:
    mines = client.get("/disruption/mines").json()
    by_id = {m["mine_id"]: m for m in mines}
    assert by_id["proj-caldeira"]["earliest_year"] == 2029
    assert by_id["proj-mount-weld"]["earliest_year"] is None


def test_nameplate_follows_the_year(client: TestClient) -> None:
    """White Mesa is staged 140 t in 2027 and 368 t in 2029; the slider must move it."""
    def nameplate(year: int) -> float | None:
        body = client.get("/disruption/proj-donald", params={"as_of_year": year}).json()
        return body["impacted"][0]["nameplate_dytb_tpa"]

    assert nameplate(2026) is None
    assert nameplate(2027) == 140
    assert nameplate(2029) == 368


def test_first_row_has_no_decisive_factor(client: TestClient) -> None:
    """Nothing sits above rank 1, so there is no comparison to report."""
    body = client.get("/disruption/proj-donald", params={"as_of_year": 2027}).json()
    top = body["impacted"][0]["alternatives"][0]
    assert top["decisive_factor"] is None
    assert top["tied_with_previous"] is False


def test_decisive_factor_names_a_real_ranking_key_field(client: TestClient) -> None:
    """It must be a field of RankingKey, not free text, so a client can map it."""
    from src.disruption import RankingKey

    valid = {f.name for f in RankingKey.__dataclass_fields__.values()}
    body = client.get("/disruption/proj-caldeira", params={"as_of_year": 2029}).json()
    seen = set()
    for impact in body["impacted"]:
        for alt in impact["alternatives"][1:]:
            assert alt["decisive_factor"] in valid
            seen.add(alt["decisive_factor"])
    assert seen, "no adjacent pair differed, so nothing was exercised"


def test_source_id_as_decisive_factor_reads_as_a_tie(client: TestClient) -> None:
    """Falling through to the id tiebreak means indistinguishable, not ranked."""
    body = client.get("/disruption/proj-caldeira", params={"as_of_year": 2029}).json()
    rows = [a for i in body["impacted"] for a in i["alternatives"]]
    for alt in rows:
        assert alt["tied_with_previous"] is (alt["decisive_factor"] == "source_id")


def test_coverage_is_labelled_and_fraction_only_on_partial(client: TestClient) -> None:
    body = client.get("/disruption/proj-caldeira", params={"as_of_year": 2029}).json()
    for impact in body["impacted"]:
        for alt in impact["alternatives"]:
            assert alt["coverage"] in {"COVERS", "PARTIAL", "UNSIZED"}
            if alt["coverage"] == "PARTIAL":
                assert 0.0 <= alt["covered_fraction"] <= 1.0
            else:
                assert alt["covered_fraction"] is None


def test_limit_does_not_change_the_decisive_factors(client: TestClient) -> None:
    """A limited list is a prefix, so each row's neighbour above is unchanged."""
    params = {"as_of_year": 2029}
    full = client.get("/disruption/proj-caldeira", params=params).json()
    capped = client.get("/disruption/proj-caldeira", params={**params, "limit": 4}).json()
    for f_imp, c_imp in zip(full["impacted"], capped["impacted"]):
        for f_alt, c_alt in zip(f_imp["alternatives"][:4], c_imp["alternatives"]):
            assert f_alt["decisive_factor"] == c_alt["decisive_factor"]


def test_facility_carries_sole_source_and_operating_status(client: TestClient) -> None:
    body = client.get("/disruption/proj-caldeira", params={"as_of_year": 2029}).json()
    by_id = {i["facility_id"]: i for i in body["impacted"]}
    ucore = by_id["fac-ucore-louisiana"]
    assert ucore["sole_source"] is True and ucore["remaining_supplies_in"] == 0
    assert ucore["operating_status"] == "UNDER_CONSTRUCTION"
    silmet = by_id["fac-neo-silmet"]
    assert silmet["sole_source"] is False and silmet["remaining_supplies_in"] >= 1


def test_decisive_factor_names_the_row_it_was_measured_against(client: TestClient) -> None:
    """A client that dedupes or reorders rows must be able to check the pairing."""
    body = client.get("/disruption/proj-caldeira", params={"as_of_year": 2029}).json()
    for impact in body["impacted"]:
        alts = impact["alternatives"]
        assert alts[0]["decisive_against"] is None
        for above, below in zip(alts, alts[1:]):
            assert below["decisive_against"] == above["source_id"]


def test_capacity_context_denominator_counts_only_disclosed_refiners(client: TestClient) -> None:
    body = client.get("/disruption/proj-mount-weld", params={"as_of_year": 2027}).json()
    ctx = body["capacity_context"]
    assert ctx["refiners_disclosing"] < ctx["refiners_total"], (
        "if every refiner disclosed a nameplate this test no longer guards anything"
    )
    assert ctx["total_tpa"] > 0


def test_undisclosed_capacity_is_null_not_zero(client: TestClient) -> None:
    """Caldeira's two plants disclose no nameplate. Zero would read as 'no weight'."""
    body = client.get("/disruption/proj-caldeira", params={"as_of_year": 2029}).json()
    ctx = body["capacity_context"]
    assert ctx["affected_share"] is None
    assert ctx["affected_tpa"] is None
    assert set(ctx["undisclosed_facility_ids"]) == {"fac-neo-silmet", "fac-ucore-louisiana"}
    for impact in body["impacted"]:
        assert impact["share_of_modelled_capacity"] is None


def test_shares_are_computed_where_capacity_is_disclosed(client: TestClient) -> None:
    body = client.get("/disruption/proj-donald", params={"as_of_year": 2027}).json()
    impact = body["impacted"][0]
    assert impact["nameplate_dytb_tpa"] == 140
    # 98 t lost against a 140 t nameplate.
    assert impact["share_of_nameplate"] == pytest.approx(0.7)
    assert impact["share_of_modelled_capacity"] == pytest.approx(140 / 2040)
    assert body["capacity_context"]["undisclosed_facility_ids"] == []


def test_concentration_moves_with_the_year(client: TestClient) -> None:
    """White Mesa and Aclara coming online dilute every other plant's share."""
    def share(year: int) -> float:
        body = client.get("/disruption/proj-mount-weld", params={"as_of_year": year}).json()
        return body["capacity_context"]["affected_share"]

    assert share(2027) > share(2029)


def test_share_of_nameplate_absent_for_a_life_of_mine_loss(client: TestClient) -> None:
    """Browns Range discloses only a LOM total, which is not an annual rate."""
    body = client.get("/disruption/proj-browns-range", params={"as_of_year": 2027}).json()
    assert body["lost_feed"]["is_annual_rate"] is False
    for impact in body["impacted"]:
        assert impact["share_of_nameplate"] is None
