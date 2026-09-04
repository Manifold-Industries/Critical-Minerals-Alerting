"""Endpoint tests for mine end-use exposure.

The contract that matters here is that the join is by element and stays honest
about what that licenses: a shipped concentrate and a required oxide share no
material id, and a reached platform is a functional dependency claim rather than
a routed path.
"""

import pytest
from fastapi.testclient import TestClient

from src.dependencies import get_graph
from src.graph import DYTB_ELEMENTS
from src.main import app
from src.service.exposure import get_exposure


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def test_unknown_mine_is_404(client: TestClient) -> None:
    assert client.get("/exposure/not-a-mine").status_code == 404


def test_a_facility_id_is_not_a_mine(client: TestClient) -> None:
    """The endpoint takes projects. A plant is a different question."""
    assert client.get("/exposure/fac-white-mesa").status_code == 404


def test_element_join_crosses_the_id_gap_a_material_join_could_not(
    client: TestClient,
) -> None:
    """Mt Weld ships mat-re-concentrate; the magnet needs mat-dy-oxide.

    No material id is shared, so a join on ids would return nothing at all.
    """
    body = client.get("/exposure/proj-mount-weld").json()
    shipped = {m["material_id"] for m in body["source_materials"] if m["shipped"]}
    magnet = next(
        c for c in body["components"] if c["component_id"] == "cmp-ndfeb-magnet"
    )
    required = {m["material_id"] for m in magnet["via_materials"]}
    assert shipped == {"mat-re-concentrate"}
    assert not shipped & required
    assert body["elements"] == ["Dy", "Tb"]


def test_derived_tonnage_is_not_reported_as_a_shipped_form(client: TestClient) -> None:
    """Mt Weld reports a Dy+Tb figure and ships concentrate. Both, kept apart."""
    body = client.get("/exposure/proj-mount-weld").json()
    by_id = {m["material_id"]: m for m in body["source_materials"]}
    assert by_id["mat-re-concentrate"]["shipped"] is True
    assert by_id["mat-dytb-combined"]["shipped"] is False


def test_platforms_are_ordered_specific_and_defence_relevant_first(
    client: TestClient,
) -> None:
    """PLATFORM before SUBSYSTEM before CATEGORY, and HIGH before MEDIUM."""
    body = client.get("/exposure/proj-mount-weld").json()
    kinds = [p["kind"] for p in body["platforms"]]
    assert kinds == sorted(
        kinds, key=lambda k: ["PLATFORM", "SUBSYSTEM", "CATEGORY"].index(k)
    )
    within = [p["confidence"] for p in body["platforms"] if p["kind"] == "PLATFORM"]
    assert within == sorted(within, key=["HIGH", "MEDIUM", "LOW"].index)
    assert body["platforms"][0]["platform_id"] == "plat-columbia-class"


def test_every_ordering_field_is_carried_so_the_order_reads_back(
    client: TestClient,
) -> None:
    body = client.get("/exposure/proj-mount-weld").json()
    for platform in body["platforms"]:
        assert set(platform) >= {"defense_relevant", "kind", "confidence", "platform_id"}


def test_confidence_is_the_weakest_link_on_the_best_path(client: TestClient) -> None:
    """Ohio-class sonar: a HIGH material edge under a MEDIUM component edge."""
    body = client.get("/exposure/proj-mount-weld").json()
    sonar = next(
        p for p in body["platforms"] if p["platform_id"] == "plat-ohio-class-sonar"
    )
    assert sonar["via_components"][0]["provenance"]["assertion_confidence"] == "MEDIUM"
    assert sonar["confidence"] == "MEDIUM"


def test_sources_resolve_every_cited_id(client: TestClient) -> None:
    """A bare source_id is not attribution: the document has to be reachable."""
    body = client.get("/exposure/proj-mount-weld").json()
    by_id = {s["id"]: s for s in body["sources"]}
    assert by_id, "platform and component edges all cite documents"

    cited = {
        prov["source_id"]
        for prov in (
            [m["provenance"] for m in body["source_materials"]]
            + [link["provenance"] for c in body["components"] for link in c["via_materials"]]
            + [link["provenance"] for p in body["platforms"] for link in p["via_components"]]
        )
        if prov and prov["source_id"]
    }
    assert cited == set(by_id), "every cited id resolves, and nothing uncited is listed"
    # Order of first citation is the only thing tying a row to an entry.
    assert len(body["sources"]) == len(by_id)
    for source in body["sources"]:
        assert source["name"]


def test_a_subsystem_keeps_its_parent_without_exposing_it(client: TestClient) -> None:
    """Ohio-class SSBN requires nothing itself; only its sonar is reached.

    The graph carries no assertion that losing a subsystem stops the parent, so
    rolling the sonar up into the hull would invent one.
    """
    body = client.get("/exposure/proj-mount-weld").json()
    by_id = {p["platform_id"]: p for p in body["platforms"]}
    assert by_id["plat-ohio-class-sonar"]["parent_id"] == "plat-ohio-class"
    assert by_id["plat-ohio-class-sonar"]["parent_name"] == "Ohio-class SSBN"
    assert "plat-ohio-class" not in by_id


def test_components_and_platforms_agree_on_which_end_use_ranks_first(
    client: TestClient,
) -> None:
    body = client.get("/exposure/proj-mount-weld").json()
    order = [p["platform_id"] for p in body["platforms"]]
    for component in body["components"]:
        ranks = [order.index(pid) for pid in component["platform_ids"]]
        assert ranks == sorted(ranks)


def test_the_flat_result_across_mines_is_warned_about_not_left_implicit() -> None:
    """Every project in this graph carries both elements, so no mine differs.

    A reader comparing two alerts would otherwise read the identical lists as a
    finding about the mines rather than a property of a Dy/Tb-scoped graph.
    """
    graph = get_graph()
    lists = {
        mine_id: tuple(p.platform_id for p in get_exposure(graph, mine_id).platforms)
        for mine_id in graph.projects
    }
    assert len(set(lists.values())) == 1
    warnings = get_exposure(graph, "proj-mount-weld").warnings
    assert any("does not distinguish between them" in w for w in warnings)


def test_a_dy_only_mine_reaches_dy_components_and_not_tb_ones() -> None:
    """The mechanism discriminates even though the current data does not.

    Narrowing the scope to Dy stands in for a mine that carries no terbium: the
    phosphor and the display systems it feeds must drop out, the control rod and
    the magnet must not.
    """
    graph = get_graph()
    result = get_exposure(graph, "proj-mount-weld", scope=frozenset({"Dy"}))
    components = {c.component_id for c in result.components}
    platforms = {p.platform_id for p in result.platforms}
    assert "cmp-dy-cermet-control-rod" in components
    assert "cmp-ndfeb-magnet" in components
    assert "cmp-tb-green-phosphor" not in components
    assert "plat-nvg-displays" not in platforms
    assert result.elements == ["Dy"]


def test_a_scope_the_graph_carries_nothing_for_reaches_nothing() -> None:
    """Out of scope returns an empty result with a warning, not an exception."""
    result = get_exposure(get_graph(), "proj-mount-weld", scope=frozenset({"Ga"}))
    assert result.elements == []
    assert result.components == []
    assert result.platforms == []
    assert any("discloses no material carrying" in w for w in result.warnings)


def test_scope_is_reported_so_a_client_never_has_to_assume_it(
    client: TestClient,
) -> None:
    body = client.get("/exposure/proj-mount-weld").json()
    assert set(body["scope_elements"]) == set(DYTB_ELEMENTS)
