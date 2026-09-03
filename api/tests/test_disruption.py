"""Behavioural tests for the disruption simulation.

The cases are chosen because each pins an invariant that is easy to regress:
supersession, no-double-counting, path dependency, and the ordering of the key.
"""

from math import fsum

import pytest

from scripts.validate_data import build
from src.disruption import (
    ALIGNMENT_RANK,
    DEFAULT_WEIGHTS,
    TIME_BUCKET_UNKNOWN,
    UNSIZED_COVERAGE_SCORE,
    WEIGHTS_VERSION,
    QuantityBasis,
    RankingKey,
    ScoreFactor,
    _TIME_LABELS,
    _coverage_measure,
    build_scoring_policy,
    simulate_disruption,
)
from src.graph import SupplyGraph
from src.models import ProvenanceType, QualificationTier


@pytest.fixture(scope="module")
def graph() -> SupplyGraph:
    return SupplyGraph.from_data(build())


def _find(impact, facility_id):
    return next(i for i in impact.impacted if i.facility_id == facility_id)


def test_unknown_mine_raises(graph: SupplyGraph) -> None:
    with pytest.raises(KeyError):
        simulate_disruption(graph, "proj-nonexistent", as_of_year=2027)


def test_severity_must_be_a_fraction(graph: SupplyGraph) -> None:
    with pytest.raises(ValueError):
        simulate_disruption(graph, "proj-mount-weld", as_of_year=2027, severity=1.5)


def test_reaches_a_refiner_two_hops_downstream(graph: SupplyGraph) -> None:
    """Mt Weld ships to Kalgoorlie, which makes MREC; only Lynas Malaysia separates."""
    impact = simulate_disruption(graph, "proj-mount-weld", as_of_year=2027)
    hit = _find(impact, "fac-lynas-malaysia")
    assert hit.hops == 2
    assert hit.via_relationship_ids == (
        "rel-mount-weld-supplies-kalgoorlie",
        "rel-kalgoorlie-supplies-lynas-malaysia",
    )


def test_intermediate_that_fails_with_the_mine_is_not_an_alternative(
    graph: SupplyGraph,
) -> None:
    """Kalgoorlie's only feed is Mt Weld, so it is part of the outage, not a remedy."""
    impact = simulate_disruption(graph, "proj-mount-weld", as_of_year=2027)
    hit = _find(impact, "fac-lynas-malaysia")
    assert "fac-lynas-kalgoorlie" not in {a.source_id for a in hit.alternatives}
    assert hit.sole_source is True
    assert hit.remaining_supplies_in == 0


def test_capacity_supersedes_rather_than_accumulating(graph: SupplyGraph) -> None:
    """White Mesa holds Dy 120/Tb 20 for 2027 and Dy 288/Tb 80 for 2029."""
    early = _find(simulate_disruption(graph, "proj-donald", as_of_year=2027), "fac-white-mesa")
    late = _find(simulate_disruption(graph, "proj-donald", as_of_year=2029), "fac-white-mesa")
    assert early.nameplate_dytb_tpa == 140
    assert late.nameplate_dytb_tpa == 368


def test_combined_disclosure_wins_over_its_derived_split(graph: SupplyGraph) -> None:
    """Caldeira discloses 127 t combined and a 104/23 split derived from it."""
    impact = simulate_disruption(graph, "proj-caldeira", as_of_year=2029)
    assert impact.lost_feed is not None
    assert impact.lost_feed.tonnes == 127


def test_life_of_mine_only_disclosure_is_not_annualised(graph: SupplyGraph) -> None:
    """Browns Range publishes LOM totals and no mine-life field exists to divide by."""
    impact = simulate_disruption(graph, "proj-browns-range", as_of_year=2028)
    assert impact.lost_feed is not None
    assert impact.lost_feed.basis is QuantityBasis.LIFE_OF_MINE_TOTAL
    assert any("life-of-mine" in w for w in impact.warnings)
    hit = _find(impact, "fac-eneabba")
    assert all(a.key.coverage_rank == 1 for a in hit.alternatives)


def test_severity_scales_the_lost_tonnage(graph: SupplyGraph) -> None:
    full = simulate_disruption(graph, "proj-monte-alto", as_of_year=2027)
    half = simulate_disruption(graph, "proj-monte-alto", as_of_year=2027, severity=0.5)
    assert full.lost_feed.tonnes == 150
    assert half.lost_feed.tonnes == 75


def test_basis_falls_back_to_category_when_host_undisclosed(graph: SupplyGraph) -> None:
    """Monte Alto ships mat-hre-concentrate with no stated host; it is still concentrate."""
    impact = simulate_disruption(graph, "proj-monte-alto", as_of_year=2027)
    assert impact.lost_feed.basis is QuantityBasis.CONTAINED_IN_CONCENTRATE


def test_curated_edges_score_full_marks_on_evidence_and_automated_ones_none(
    graph: SupplyGraph,
) -> None:
    """Evidence is a weighted factor now, not an absolute gate.

    The lexicographic key made a curated row beat an automated one whatever else
    was true. Scoring prices that preference instead, so the invariant that
    survives is the normalisation, not the output order.
    """
    impact = simulate_disruption(graph, "proj-monte-alto", as_of_year=2027)
    hit = _find(impact, "fac-caremag-lacq")
    for alt in hit.alternatives:
        automated = alt.provenance.type is ProvenanceType.AUTOMATED
        factor = alt.score.factor(ScoreFactor.EVIDENCE)
        assert factor.normalized == (0.0 if automated else 1.0)
        assert factor.raw_label == ("AUTOMATED" if automated else "CURATED")
        assert alt.key.evidence_class == (1 if automated else 0)


def test_infeasible_routes_are_pruned(graph: SupplyGraph) -> None:
    impact = simulate_disruption(graph, "proj-browns-range", as_of_year=2028)
    hit = _find(impact, "fac-eneabba")
    assert all(a.qualification is not QualificationTier.INFEASIBLE for a in hit.alternatives)


def test_alignment_ranks_third_behind_evidence_and_time(graph: SupplyGraph) -> None:
    """A DOMESTIC candidate must not overtake a nearer-term one of the same class."""
    impact = simulate_disruption(graph, "proj-monte-alto", as_of_year=2027)
    hit = _find(impact, "fac-caremag-lacq")
    by_id = {a.source_id: a for a in hit.alternatives}
    round_top, serra_verde = by_id["proj-round-top"], by_id["proj-serra-verde"]
    assert round_top.alignment == "DOMESTIC" and serra_verde.alignment == "PARTNER"
    assert round_top.key.time_bucket > serra_verde.key.time_bucket
    assert serra_verde.key < round_top.key


def test_unassessed_alignment_sorts_with_neutral_not_below_it() -> None:
    assert ALIGNMENT_RANK[None] == ALIGNMENT_RANK["NEUTRAL"]
    assert ALIGNMENT_RANK[None] < ALIGNMENT_RANK["ADVERSARY"]


def test_ranking_key_orders_lexicographically() -> None:
    better = RankingKey(0, 5, 3, 2, 1.0, 1, 3, "zzz")
    worse = RankingKey(1, 0, 0, 0, 0.0, 0, 0, "aaa")
    assert better < worse


def test_results_are_sorted_by_score(graph: SupplyGraph) -> None:
    impact = simulate_disruption(graph, "proj-browns-range", as_of_year=2028)
    for hit in impact.impacted:
        scores = [a.score.value for a in hit.alternatives]
        assert scores == sorted(scores, reverse=True)


def test_the_key_breaks_exact_score_ties(graph: SupplyGraph) -> None:
    """Equal scores must still order deterministically, or output is unstable."""
    impact = simulate_disruption(graph, "proj-caldeira", as_of_year=2029)
    tied = 0
    for hit in impact.impacted:
        for above, below in zip(hit.alternatives, hit.alternatives[1:]):
            if above.score.value == below.score.value:
                tied += 1
                assert above.key < below.key
    assert tied, "no adjacent pair tied, so the tiebreak was never exercised"


# --- scoring -----------------------------------------------------------------


def test_contributions_sum_to_the_score(graph: SupplyGraph) -> None:
    """The composite must be fully decomposable, or it hides its own reasoning."""
    impact = simulate_disruption(graph, "proj-monte-alto", as_of_year=2027)
    for hit in impact.impacted:
        for alt in hit.alternatives:
            assert fsum(f.contribution for f in alt.score.factors) == pytest.approx(
                alt.score.value, abs=1e-6
            )


def test_scores_stay_on_a_nought_to_hundred_scale(graph: SupplyGraph) -> None:
    for mine in ("proj-monte-alto", "proj-browns-range", "proj-caldeira"):
        impact = simulate_disruption(graph, mine, as_of_year=2029)
        for hit in impact.impacted:
            for alt in hit.alternatives:
                assert 0.0 <= alt.score.value <= 100.0
                assert all(0.0 <= f.normalized <= 1.0 for f in alt.score.factors)


def test_a_strong_secondary_factor_can_outweigh_alignment(graph: SupplyGraph) -> None:
    """The whole point of a score, on a case the key could not express.

    Sareco and Serra Verde tie on evidence, time and coverage. The key decides on
    alignment - PARTNER over NEUTRAL - and never reaches commitment, because
    alignment is absolute over everything beneath it. The score weighs both, and
    being uncommitted is worth more than one step of alignment.
    """
    impact = simulate_disruption(graph, "proj-browns-range", as_of_year=2028)
    hit = _find(impact, "fac-eneabba")
    by_id = {a.source_id: a for a in hit.alternatives}
    sareco, serra = by_id["fac-sareco"], by_id["proj-serra-verde"]

    assert serra.key < sareco.key
    assert serra.key.alignment_rank < sareco.key.alignment_rank
    assert (sareco.key.committed, serra.key.committed) == (0, 1)

    assert sareco.score.value > serra.score.value
    assert hit.alternatives.index(sareco) < hit.alternatives.index(serra)


def test_unsized_coverage_still_outranks_every_known_partial() -> None:
    """Carried across from the key deliberately - see UNSIZED_COVERAGE_SCORE."""

    def coverage(rank: int, shortfall: float) -> float:
        return _coverage_measure(RankingKey(0, 0, 0, rank, shortfall, 0, 0, "x"))[0]

    assert coverage(0, 0.0) == 1.0
    assert coverage(2, 1.0) < coverage(2, 0.001) < coverage(1, 0.0)
    assert coverage(1, 0.0) == UNSIZED_COVERAGE_SCORE


def test_a_fallback_is_marked_rather_than_passed_off_as_data(graph: SupplyGraph) -> None:
    """``known`` is how a client sees the score is not resting on a disclosure."""
    impact = simulate_disruption(graph, "proj-browns-range", as_of_year=2028)
    rows = [a for i in impact.impacted for a in i.alternatives]

    coverage = [a.score.factor(ScoreFactor.COVERAGE) for a in rows]
    assert coverage and all(not f.known and f.raw is None and f.detail for f in coverage)

    blind = [a.score.factor(ScoreFactor.TIME_TO_FLOW) for a in rows if a.months_to_flow is None]
    assert blind, "no candidate had unknown readiness, so nothing was exercised"
    assert all(f.normalized == 0.0 and not f.known and f.raw is None for f in blind)


def test_excluding_a_factor_renormalises_the_rest(graph: SupplyGraph) -> None:
    """Scores must stay comparable across policies, or the parameter is a trap."""
    trimmed = simulate_disruption(
        graph, "proj-monte-alto", as_of_year=2027, exclude_factors=[ScoreFactor.ALIGNMENT]
    )
    for hit in trimmed.impacted:
        for alt in hit.alternatives:
            assert fsum(f.max_contribution for f in alt.score.factors) == pytest.approx(
                100.0, abs=1e-4
            )

    dropped = _find(trimmed, "fac-caremag-lacq").alternatives[0].score.factor(ScoreFactor.ALIGNMENT)
    assert dropped.excluded and dropped.weight == 0.0 and dropped.contribution == 0.0
    # Still reported: excluded and never-computed are different statements.
    assert dropped.raw_label and dropped.max_contribution == 0.0


def test_an_excluded_factor_is_reported_and_warned_about(graph: SupplyGraph) -> None:
    impact = simulate_disruption(
        graph, "proj-monte-alto", as_of_year=2027, exclude_factors=["confidence"]
    )
    assert impact.scoring.excluded == (ScoreFactor.CONFIDENCE,)
    assert any("scores exclude confidence" in w for w in impact.warnings)


def test_evidence_decides_alone_when_it_is_the_only_factor(graph: SupplyGraph) -> None:
    """Excluding everything else recovers the gate the key used to apply."""
    impact = simulate_disruption(
        graph,
        "proj-monte-alto",
        as_of_year=2027,
        exclude_factors=[f for f in ScoreFactor if f is not ScoreFactor.EVIDENCE],
    )
    hit = _find(impact, "fac-caremag-lacq")
    assert [a.key.evidence_class for a in hit.alternatives] == sorted(
        a.key.evidence_class for a in hit.alternatives
    )
    assert {a.score.value for a in hit.alternatives} <= {0.0, 100.0}


def test_default_policy_reports_the_shipped_version() -> None:
    policy = build_scoring_policy()
    assert policy.version == WEIGHTS_VERSION
    assert policy.excluded == ()
    assert policy.total_weight == pytest.approx(sum(DEFAULT_WEIGHTS.values()))


def test_weights_merge_over_the_defaults_rather_than_replacing_them() -> None:
    policy = build_scoring_policy(weights={"alignment": 0.5})
    assert policy.weight_of(ScoreFactor.ALIGNMENT) == 0.5
    assert policy.weight_of(ScoreFactor.COVERAGE) == DEFAULT_WEIGHTS[ScoreFactor.COVERAGE]
    assert policy.version.endswith("+custom")


def test_scoring_on_nothing_raises() -> None:
    with pytest.raises(ValueError, match="no factors left"):
        build_scoring_policy(exclude_factors=list(ScoreFactor))


def test_negative_weight_raises() -> None:
    with pytest.raises(ValueError, match="must not be negative"):
        build_scoring_policy(weights={ScoreFactor.ALIGNMENT: -1.0})


def test_unknown_factor_raises() -> None:
    with pytest.raises(ValueError, match="unknown score factor"):
        build_scoring_policy(exclude_factors=["reputation"])


def test_the_tiebreak_is_not_a_scoring_factor() -> None:
    """A factor for source_id would score candidates on the spelling of their id."""
    assert "source_id" not in set(ScoreFactor)
    assert len(ScoreFactor) == 6


def test_every_time_bucket_has_a_label() -> None:
    """Missing one is an IndexError deep inside scoring, not a wrong number."""
    assert len(_TIME_LABELS) == TIME_BUCKET_UNKNOWN + 1
