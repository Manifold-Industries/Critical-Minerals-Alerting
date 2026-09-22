"""Endpoint tests for per-node OSINT.

Two contracts matter here and they pull in different directions.

The *frontend* contract is deliberately generic: a node id, a corpus timestamp
and a ranked list of developments, each with a title, a source, a date, a
priority, a category and prose. Nothing in it names critical minerals, and a
client written against it must survive a corpus produced by something other
than a curated file.

The *evidence* contract is this repo's: a node id that names no asset is a
broken citation, a ranking label is not a validated risk score, and a figure
nobody recorded is not invented to fill a field. Those are what the corpus
validation and the ranking-note tests pin.
"""

from datetime import date
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from src.main import app
from src.osint import load_corpus
from src.service.osint import rank_developments

#: A node the corpus covers, and one it does not. Both exist in the graph.
COVERED = "proj-browns-range"
UNCOVERED = "fac-white-mesa"

#: Same date on every row, so only the key under test can move the order.
SAME_DAY = date(2026, 1, 1)


def row(dev_id: str, priority: str, relevance: float, published: date = SAME_DAY):
    """The four fields the ranking reads, and nothing else.

    ``rank_developments`` is written against those four rather than against the
    response schema, so a stand-in carrying them is the honest unit here.
    """
    return SimpleNamespace(
        id=dev_id,
        priority=priority,
        relevance_score=relevance,
        published_at=published,
    )


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def test_unknown_node_is_404(client: TestClient) -> None:
    """Same answer as /assets for the same id. OSINT does not invent nodes."""
    assert client.get("/assets/not-an-asset/osint").status_code == 404


def test_a_node_the_corpus_does_not_cover_returns_an_empty_list(
    client: TestClient,
) -> None:
    """Monitoring is a capability of every node, not of the demo's five.

    A 404 here would tell the console to hide the section, which would say
    the node cannot be monitored rather than that nothing has been found.
    """
    res = client.get(f"/assets/{UNCOVERED}/osint")
    assert res.status_code == 200
    assert res.json()["developments"] == []


def test_response_echoes_the_node_and_dates_the_corpus(client: TestClient) -> None:
    body = client.get(f"/assets/{COVERED}/osint").json()
    assert body["node_id"] == COVERED
    assert body["generated_at"] == "2026-09-22"


def test_every_development_carries_what_the_card_requires(client: TestClient) -> None:
    """Title, source, date, priority, category, summary, why it matters.

    The client tolerates a missing optional field; it cannot render a card
    without these.
    """
    body = client.get(f"/assets/{COVERED}/osint").json()
    assert body["developments"]
    for dev in body["developments"]:
        assert dev["id"] and dev["title"]
        assert dev["source"]["name"]
        assert dev["published_at"] and dev["category"] and dev["priority"]
        assert dev["summary"] and dev["why_it_matters"]


def test_developments_are_ranked_not_dated(client: TestClient) -> None:
    """Serra Verde's closing (Sep) outranks its announcement (Apr) on relevance,
    and its offtake capitalisation (Aug) comes last though it is newer than the
    announcement. Newest-first would give a different order."""
    body = client.get("/assets/proj-serra-verde/osint").json()
    assert [d["id"] for d in body["developments"]] == [
        "sv-2026-09-04-acquisition-completed",
        "sv-2026-04-20-acquisition-announced",
        "sv-2026-08-24-offtake-capitalization",
    ]


def test_priority_outranks_relevance() -> None:
    """The primary key is the label, not the score, so a HIGH row never
    overtakes a VERY_HIGH one on a fractionally better score."""
    ranked = rank_developments([row("b", "HIGH", 0.99), row("a", "VERY_HIGH", 0.10)])
    assert [d.id for d in ranked] == ["a", "b"]


def test_recency_breaks_a_tie_but_never_leads() -> None:
    """Newer wins only once priority and relevance agree."""
    older_but_better = row("better", "HIGH", 0.9, date(2026, 1, 1))
    newer = row("newer", "HIGH", 0.5, date(2026, 9, 1))
    assert [d.id for d in rank_developments([newer, older_but_better])] == [
        "better",
        "newer",
    ]
    same_score = row("same", "HIGH", 0.5, date(2026, 3, 1))
    assert [d.id for d in rank_developments([same_score, newer])] == ["newer", "same"]


def test_ranking_is_total_so_the_order_never_wobbles() -> None:
    """Equal priority, equal score, equal date. Two requests must not disagree,
    so the last key is the id rather than input order."""
    rows = [row("z", "HIGH", 0.5), row("a", "HIGH", 0.5)]
    assert [d.id for d in rank_developments(rows)] == ["a", "z"]
    assert [d.id for d in rank_developments(list(reversed(rows)))] == ["a", "z"]


def test_an_unrecognised_priority_sorts_last_rather_than_first() -> None:
    """A label the ranking does not know is not a high one. A new domain may
    introduce one, and it must not float to the top of the list."""
    ranked = rank_developments([row("new", "CRITICAL", 1.0), row("low", "LOW", 0.0)])
    assert [d.id for d in ranked] == ["low", "new"]


def test_the_ranking_caveat_travels_with_the_ranking(client: TestClient) -> None:
    """Priority and relevance are ranking outputs, not validated risk scores.

    The caveat comes from whoever produced the corpus: a continuous pipeline
    would owe a different one, and a console that wrote its own would be
    describing a method it does not know.
    """
    body = client.get(f"/assets/{COVERED}/osint").json()
    assert "not independently validated" in body["ranking_note"]


def test_no_count_of_documents_screened_is_invented(client: TestClient) -> None:
    """The field is in the contract for a collector that records it. This
    corpus does not, and a number nobody measured is worse than none."""
    body = client.get(f"/assets/{COVERED}/osint").json()
    assert body["sources_analyzed"] is None


def test_categories_stay_the_corpus_strings(client: TestClient) -> None:
    """Not narrowed to an enum. A new domain introduces new categories, and
    the API must carry one it has never seen."""
    body = client.get("/assets/proj-kangankunde/osint").json()
    assert {d["category"] for d in body["developments"]} == {
        "PROJECT_STAGE_CHANGE",
        "PROJECT_EXECUTION",
    }


def test_an_unanchored_article_would_return_a_null_url(client: TestClient) -> None:
    """Every article in this corpus links out, but the field is optional and a
    client must not render a dead link in its place."""
    body = client.get(f"/assets/{COVERED}/osint").json()
    assert all("url" in d["source"] for d in body["developments"])


# ── Corpus integrity ────────────────────────────────────────────────────────
#
# The corpus is loaded beside the graph rather than into it: it is a snapshot
# of an external feed with its own lifecycle, and its ranking labels are not
# the attested provenance the graph is built on. What it does owe the graph is
# resolvable node ids - an association to a node that does not exist is the
# OSINT equivalent of a citation nothing can resolve.


def test_every_corpus_node_names_an_asset_in_the_graph(client: TestClient) -> None:
    for node_id in load_corpus().nodes:
        assert client.get(f"/assets/{node_id}").status_code == 200, node_id


def test_article_ids_are_unique_across_the_corpus(client: TestClient) -> None:
    """The id is what a client keys a card on."""
    ids = [a.id for node in load_corpus().nodes.values() for a in node.articles]
    assert len(ids) == len(set(ids))
