"""Qualitative ranking factors and the ordinal scale they share.

Three of the six factors are the same shape: a vocabulary someone ordered by
hand. These pin the shared machinery (``OrdinalScale``) and the editorial
decisions encoded in the operating-status table, which are judgements the code
cannot check for itself and so have to be stated somewhere.
"""

from dataclasses import replace

import pytest

from scripts.validate_data import build
from src.disruption import (
    ALIGNMENT_SCALE,
    CONFIDENCE_SCALE,
    DROPPED_STATUSES,
    OPERATING_STATUS_SCALE,
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
    candidate, so the rules below have no live example to rest on. Restating
    them as a fixture would drift from the real graph; substituting one field
    of it will not.
    """
    project = graph.projects[project_id]
    moved = replace(project, operating_status=replace(project.operating_status, value=status))
    return replace(graph, projects={**graph.projects, project_id: moved})


def _alternatives(graph: SupplyGraph, mine: str, year: int, plant: str):
    impact = simulate_disruption(graph, mine, as_of_year=year)
    hit = next(i for i in impact.impacted if i.facility_id == plant)
    return {a.source_id: a for a in hit.alternatives}


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
    accident. This is what 'suspended and planned are the same' rests on."""
    scale = OrdinalScale(
        factor=ScoreFactor.OPERATING_STATUS,
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


def test_the_three_qualitative_factors_all_go_through_one_scale() -> None:
    """The point of the abstraction: adding a fourth is a table, not arithmetic."""
    scales = (ALIGNMENT_SCALE, CONFIDENCE_SCALE, OPERATING_STATUS_SCALE)
    assert all(isinstance(s, OrdinalScale) for s in scales)
    assert {s.factor for s in scales} == {
        ScoreFactor.ALIGNMENT,
        ScoreFactor.CONFIDENCE,
        ScoreFactor.OPERATING_STATUS,
    }


# --- the operating-status table ----------------------------------------------


def test_operating_status_runs_from_producing_to_shut() -> None:
    rank = OPERATING_STATUS_SCALE.rank_of
    assert (
        rank(OperatingStatus.OPERATING)
        < rank(OperatingStatus.COMMISSIONING)
        < rank(OperatingStatus.UNDER_CONSTRUCTION)
        < rank(OperatingStatus.PLANNED)
        < rank(OperatingStatus.CLOSED)
    )


def test_suspended_and_planned_are_the_same_answer() -> None:
    """An editorial decision, not a derived one. A paused mine and an unbuilt
    one are both 'not producing, no stated date', and the graph holds nothing
    that separates them."""
    assert OPERATING_STATUS_SCALE.rank_of(
        OperatingStatus.SUSPENDED
    ) == OPERATING_STATUS_SCALE.rank_of(OperatingStatus.PLANNED)


def test_an_unstated_status_scores_at_the_floor_not_in_the_middle() -> None:
    """Unlike alignment, which scores an unassessed country with NEUTRAL. A node
    whose status nobody recorded must not outrank one known to be producing."""
    assert OPERATING_STATUS_SCALE.rank_of(None) == OPERATING_STATUS_SCALE.max_rank
    assert OPERATING_STATUS_SCALE.measure(None, OPERATING_STATUS_SCALE.max_rank).normalized == 0.0


def test_every_status_in_the_vocabulary_is_ranked() -> None:
    """A status missing from the table scores at the floor with no label saying
    so, which reads as a disclosure rather than a gap."""
    assert set(OPERATING_STATUS_SCALE.ranks) == {s.value for s in OperatingStatus}


# --- status in a live ranking ------------------------------------------------


def test_status_is_measured_on_every_candidate(graph: SupplyGraph) -> None:
    rows = _alternatives(graph, "proj-monte-alto", 2027, "fac-caremag-lacq")
    operating = rows["proj-mountain-pass"].score.factor(ScoreFactor.OPERATING_STATUS)
    planned = rows["proj-round-top"].score.factor(ScoreFactor.OPERATING_STATUS)

    assert operating.raw_label == "OPERATING" and operating.normalized == 1.0
    assert planned.raw_label == "PLANNED" and planned.normalized < operating.normalized
    assert operating.known and planned.known


def test_weighting_status_puts_a_producing_mine_over_an_unbuilt_one(
    graph: SupplyGraph,
) -> None:
    """Round Top is DOMESTIC and Mountain Pass is too, so alignment alone cannot
    separate them. Status can, and that is the point of adding it."""
    impact = simulate_disruption(
        graph,
        "proj-monte-alto",
        as_of_year=2027,
        weights={ScoreFactor.OPERATING_STATUS: 1.0, ScoreFactor.ALIGNMENT: 1.0},
    )
    hit = next(i for i in impact.impacted if i.facility_id == "fac-caremag-lacq")
    rows = {a.source_id: a for a in hit.alternatives}
    mountain_pass, round_top = rows["proj-mountain-pass"], rows["proj-round-top"]

    assert mountain_pass.alignment == round_top.alignment == "DOMESTIC"
    assert mountain_pass.score.value > round_top.score.value
    assert hit.alternatives.index(mountain_pass) < hit.alternatives.index(round_top)


def test_a_suspended_candidate_scores_where_a_planned_one_does(
    graph: SupplyGraph,
) -> None:
    suspended = _with_status(graph, "proj-makuutu", OperatingStatus.SUSPENDED)
    rows = _alternatives(suspended, "proj-monte-alto", 2027, "fac-caremag-lacq")
    paused = rows["proj-makuutu"].score.factor(ScoreFactor.OPERATING_STATUS)
    unbuilt = rows["proj-songwe-hill"].score.factor(ScoreFactor.OPERATING_STATUS)

    assert paused.raw_label == "SUSPENDED" and unbuilt.raw_label == "PLANNED"
    assert paused.normalized == unbuilt.normalized


def test_a_closed_candidate_is_dropped_rather_than_ranked_last(
    graph: SupplyGraph,
) -> None:
    """Scoring it last still offers it. A shut plant is not a slower option, it
    is not an option, so it leaves the pool before anything is measured."""
    before = _alternatives(graph, "proj-monte-alto", 2027, "fac-caremag-lacq")
    assert "proj-lofdal" in before

    closed = _with_status(graph, "proj-lofdal", OperatingStatus.CLOSED)
    after = _alternatives(closed, "proj-monte-alto", 2027, "fac-caremag-lacq")
    assert "proj-lofdal" not in after
    assert set(after) == set(before) - {"proj-lofdal"}


def test_the_drop_list_is_the_gate_the_scale_is_not(graph: SupplyGraph) -> None:
    """CLOSED stays in the rank table although nothing closed reaches scoring,
    so its label is available if the gate ever moves."""
    assert DROPPED_STATUSES == frozenset({OperatingStatus.CLOSED})
    assert OperatingStatus.CLOSED.value in OPERATING_STATUS_SCALE.ranks


# --- what replaced time-to-flow ----------------------------------------------


def test_time_to_flow_is_no_longer_a_scoring_factor() -> None:
    """Dropped when status arrived: both answered 'can this feed me soon', and a
    reader weighting each got one preference counted twice."""
    assert "time_to_flow" not in set(ScoreFactor)
    assert len(ScoreFactor) == 6


def test_the_key_still_orders_on_status_where_it_ordered_on_time() -> None:
    better = RankingKey(0, 0, 3, 2, 1.0, 1, 3, "zzz")
    worse = RankingKey(0, 1, 0, 0, 0.0, 0, 0, "aaa")
    assert better.status_rank < worse.status_rank
    assert better < worse


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
