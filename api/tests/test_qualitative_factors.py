"""The ordinal scale behind the qualitative factors, and the operating-status gate.

Two separate mechanisms, kept in one file because operating status moved
between them. Alignment and assertion confidence are *scored*: vocabularies
ordered by hand and normalised by position, which is what ``OrdinalScale`` is
for. Operating status is *not* scored - it decides whether a candidate is on
the list at all, which no weight can express.
"""

from dataclasses import replace

import pytest

from scripts.validate_data import build
from src.disruption import (
    ALIGNMENT_SCALE,
    CONFIDENCE_SCALE,
    OPERATING_STATUS_RANK,
    RANKABLE_STATUSES,
    OrdinalScale,
    RankingKey,
    ScoreFactor,
    _years_to_ready,
    simulate_disruption,
)
from src.graph import SupplyGraph
from src.models import OperatingStatus


@pytest.fixture(scope="module")
def graph() -> SupplyGraph:
    return SupplyGraph.from_data(build())


def _with_status(graph: SupplyGraph, project_id: str, status: OperatingStatus) -> SupplyGraph:
    """The same graph with one project's operating status changed.

    The seed data holds no suspended asset and no closed one that is anybody's
    candidate, so those rules have no live example to rest on. Restating the
    graph as a fixture would drift from the real one; substituting a single
    field of it will not.
    """
    project = graph.projects[project_id]
    moved = replace(project, operating_status=replace(project.operating_status, value=status))
    return replace(graph, projects={**graph.projects, project_id: moved})


def _alternatives(graph: SupplyGraph, mine: str, year: int, plant: str):
    impact = simulate_disruption(graph, mine, as_of_year=year)
    hit = next(i for i in impact.impacted if i.facility_id == plant)
    return {a.source_id: a for a in hit.alternatives}


def _status_of(graph: SupplyGraph, source_id: str) -> OperatingStatus:
    node = graph.projects.get(source_id) or graph.facilities.get(source_id)
    return node.operating_status.value


# --- the shared scale --------------------------------------------------------


def test_a_scale_normalises_best_to_one_and_worst_to_zero() -> None:
    scale = OrdinalScale(
        factor=ScoreFactor.ALIGNMENT,
        ranks={"BEST": 0, "MIDDLE": 1, "WORST": 2},
        unknown_rank=2,
        unknown_label="UNSTATED",
        unknown_detail="nothing stated",
    )
    assert scale.max_rank == 2
    assert scale.measure("BEST", scale.rank_of("BEST")).normalized == 1.0
    assert scale.measure("MIDDLE", scale.rank_of("MIDDLE")).normalized == 0.5
    assert scale.measure("WORST", scale.rank_of("WORST")).normalized == 0.0


def test_categories_sharing_a_rank_score_the_same() -> None:
    """A tie in the table must be a tie in the score, not a declaration-order
    accident."""
    scale = OrdinalScale(
        factor=ScoreFactor.ALIGNMENT,
        ranks={"GOOD": 0, "SAME_A": 1, "SAME_B": 1, "BAD": 2},
        unknown_rank=2,
        unknown_label="UNSTATED",
        unknown_detail="nothing stated",
    )
    a = scale.measure("SAME_A", scale.rank_of("SAME_A"))
    b = scale.measure("SAME_B", scale.rank_of("SAME_B"))
    assert a.normalized == b.normalized
    assert a.raw == b.raw
    assert a.raw_label != b.raw_label


def test_an_unheld_value_is_marked_rather_than_passed_off_as_data() -> None:
    scale = OrdinalScale(
        factor=ScoreFactor.CONFIDENCE,
        ranks={"HIGH": 0, "LOW": 1},
        unknown_rank=2,
        unknown_label="UNSTATED",
        unknown_detail="nobody stated one",
    )
    measured = scale.measure(None, scale.rank_of(None))
    assert measured.known is False
    assert measured.raw_label == "UNSTATED"
    assert measured.detail == "nobody stated one"
    # A value outside the vocabulary is the same statement as no value at all.
    assert scale.rank_of("MOTHBALLED") == scale.rank_of(None)


def test_a_scale_that_cannot_order_anything_is_refused_at_import() -> None:
    """One position normalises by zero. Raised where the table is written, not
    from inside scoring, where the traceback would not name the cause."""
    with pytest.raises(ValueError, match="one position"):
        OrdinalScale(
            factor=ScoreFactor.ALIGNMENT,
            ranks={"ONLY": 0},
            unknown_rank=0,
            unknown_label="UNSTATED",
            unknown_detail="nothing stated",
        )
    with pytest.raises(ValueError, match="no categories"):
        OrdinalScale(
            factor=ScoreFactor.ALIGNMENT,
            ranks={},
            unknown_rank=1,
            unknown_label="UNSTATED",
            unknown_detail="nothing stated",
        )


def test_both_qualitative_factors_go_through_one_scale() -> None:
    """The point of the abstraction: adding a third is a table, not arithmetic."""
    scales = (ALIGNMENT_SCALE, CONFIDENCE_SCALE)
    assert all(isinstance(s, OrdinalScale) for s in scales)
    assert {s.factor for s in scales} == {ScoreFactor.ALIGNMENT, ScoreFactor.CONFIDENCE}


# --- operating status is a gate, not a score ---------------------------------


def test_operating_status_is_not_a_scoring_factor() -> None:
    """It decides membership of the list. A weight cannot express that: any
    weight above zero still leaves a shut mine on the list, one weight change
    away from the top of it."""
    assert "operating_status" not in set(ScoreFactor)
    assert len(ScoreFactor) == 5


def test_only_assets_that_can_ship_are_ranked(graph: SupplyGraph) -> None:
    """Across every mine and the whole year band, not one sampled case."""
    seen: set[OperatingStatus] = set()
    for mine_id in graph.projects:
        for year in (2025, 2027, 2029):
            impact = simulate_disruption(graph, mine_id, as_of_year=year)
            for hit in impact.impacted:
                seen |= {_status_of(graph, a.source_id) for a in hit.alternatives}
    assert seen, "no candidate was ranked at all, so nothing was exercised"
    assert seen <= RANKABLE_STATUSES


def test_the_gate_admits_producing_and_starting_up(graph: SupplyGraph) -> None:
    """The threshold, stated once. Commissioning is in because the engine
    already treats it as able to ship - see READY_STATUSES."""
    assert RANKABLE_STATUSES == frozenset(
        {OperatingStatus.OPERATING, OperatingStatus.COMMISSIONING}
    )


def test_a_planned_mine_is_not_offered(graph: SupplyGraph) -> None:
    rows = _alternatives(graph, "proj-monte-alto", 2027, "fac-caremag-lacq")
    assert _status_of(graph, "proj-round-top") is OperatingStatus.PLANNED
    assert "proj-round-top" not in rows
    # And it is the gate that removed it, not some unrelated prune.
    reopened = _with_status(graph, "proj-round-top", OperatingStatus.OPERATING)
    assert "proj-round-top" in _alternatives(
        reopened, "proj-monte-alto", 2027, "fac-caremag-lacq"
    )


@pytest.mark.parametrize(
    "status", [OperatingStatus.SUSPENDED, OperatingStatus.CLOSED, OperatingStatus.PLANNED]
)
def test_a_source_that_stops_being_operational_leaves_the_list(
    graph: SupplyGraph, status: OperatingStatus
) -> None:
    before = _alternatives(graph, "proj-browns-range", 2028, "fac-eneabba")
    assert "proj-mount-weld" in before

    stopped = _with_status(graph, "proj-mount-weld", status)
    after = _alternatives(stopped, "proj-browns-range", 2028, "fac-eneabba")
    assert "proj-mount-weld" not in after
    assert set(after) == set(before) - {"proj-mount-weld"}


def test_a_pruned_pool_says_how_much_it_pruned(graph: SupplyGraph) -> None:
    """Most of this graph is pre-production, so the gate removes most of the
    reroute space. A list that shrank by an order of magnitude without saying
    so reads as a graph with no options rather than a filter with an opinion."""
    impact = simulate_disruption(graph, "proj-monte-alto", as_of_year=2027)
    assert any("not operating" in w for w in impact.warnings)


def test_status_still_separates_two_candidates_that_score_alike(
    graph: SupplyGraph,
) -> None:
    """Gating to two statuses leaves one distinction inside the list, and a
    producing mine should come before one still starting up."""
    rows = _alternatives(graph, "proj-monte-alto", 2027, "fac-caremag-lacq")
    producing = next(
        a for a in rows.values() if _status_of(graph, a.source_id) is OperatingStatus.OPERATING
    )
    starting = next(
        a
        for a in rows.values()
        if _status_of(graph, a.source_id) is OperatingStatus.COMMISSIONING
    )
    assert producing.key.status_rank < starting.key.status_rank


def test_status_outranks_preference_inside_a_tied_pair(graph: SupplyGraph) -> None:
    """Feasibility before preference, on live rows.

    Serra Verde and Caldeira are both Brazilian and both commissioning, so they
    tie on score outright and the key separates them. Bring one into production
    and it must move above the other, because ``status_rank`` sits above
    ``alignment_rank`` in the key.
    """
    before = _alternatives(graph, "proj-monte-alto", 2027, "fac-caremag-lacq")
    serra, caldeira = before["proj-serra-verde"], before["proj-caldeira"]
    assert serra.score.value == caldeira.score.value
    assert list(before).index("proj-serra-verde") < list(before).index("proj-caldeira")

    promoted = _with_status(graph, "proj-caldeira", OperatingStatus.OPERATING)
    after = _alternatives(promoted, "proj-monte-alto", 2027, "fac-caremag-lacq")
    assert after["proj-caldeira"].score.value == after["proj-serra-verde"].score.value
    assert list(after).index("proj-caldeira") < list(after).index("proj-serra-verde")


def test_the_gate_is_reported_on_every_row(graph: SupplyGraph) -> None:
    """A reader must be able to see the rule was applied rather than trust it."""
    rows = _alternatives(graph, "proj-monte-alto", 2027, "fac-caremag-lacq")
    assert rows
    assert all(a.operating_status in RANKABLE_STATUSES for a in rows.values())


def test_every_status_in_the_vocabulary_is_ranked() -> None:
    """The tiebreak table still covers the whole vocabulary, so tightening or
    loosening the gate cannot land a status on an undefined rank."""
    assert set(OPERATING_STATUS_RANK) == {s.value for s in OperatingStatus}
    assert RANKABLE_STATUSES <= set(OPERATING_STATUS_RANK)


# --- readiness ---------------------------------------------------------------


def test_readiness_is_unknown_once_a_stated_start_has_passed(
    graph: SupplyGraph,
) -> None:
    """Eneabba is under construction with a stated start of 2027. Asked about
    2028, the old arithmetic clamped the negative gap to zero and reported a
    plant still being built as able to ship today."""
    assert _years_to_ready(graph, "fac-eneabba", 2026) == 1
    assert _years_to_ready(graph, "fac-eneabba", 2027) == 0
    assert _years_to_ready(graph, "fac-eneabba", 2028) is None


def test_an_operating_asset_ships_now_whatever_year_is_asked(
    graph: SupplyGraph,
) -> None:
    """The clamp is only wrong for assets that are not producing yet."""
    assert _years_to_ready(graph, "proj-mount-weld", 2029) == 0


def test_the_key_orders_on_status_before_preference() -> None:
    better = RankingKey(0, 0, 3, 2, 1.0, 1, 3, "zzz")
    worse = RankingKey(0, 1, 0, 0, 0.0, 0, 0, "aaa")
    assert better.status_rank < worse.status_rank
    assert better < worse
