"""Integration tests for GET /graph against the real seed data."""

from collections import Counter

from fastapi.testclient import TestClient


def test_graph_counts_shape_and_context(client: TestClient) -> None:
    response = client.get("/graph")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    data = body["data"]

    assert len(data["nodes"]) == 43
    assert len(data["edges"]) == 49
    derived = [e for e in data["edges"] if e["derived"]]
    assert len(data["edges"]) - len(derived) == 16
    assert Counter(e["type"] for e in derived) == {
        "OPERATES": 10,
        "PRODUCES": 8,
        "REQUIRES": 10,
        "DEVELOPS": 4,
        "SUBSIDIARY_OF": 1,
    }
    assert len(data["context"]["countries"]) == 5
    assert len(data["context"]["sources"]) == 9


def test_every_edge_endpoint_resolves_to_a_node(client: TestClient) -> None:
    data = client.get("/graph").json()["data"]
    node_ids = {n["id"] for n in data["nodes"]}

    for node in data["nodes"]:
        assert node["kind"] and node["name"] and node["entity"]["id"] == node["id"]
    for edge in data["edges"]:
        assert edge["from_id"] in node_ids, edge["id"]
        if edge["to_id"] is None:
            assert edge["status"] == "UNRESOLVED", edge["id"]
        else:
            assert edge["to_id"] in node_ids, edge["id"]
