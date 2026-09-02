"""Behavioural tests for the disruption simulation.

The cases are chosen because each pins an invariant that is easy to regress:
supersession, no-double-counting, path dependency, and the ordering of the key.
"""

import pytest

from scripts.validate_data import build
from src.disruption import (
    ALIGNMENT_RANK,
    QuantityBasis,
    RankingKey,
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


def test_curated_edges_outrank_automated_ones(graph: SupplyGraph) -> None:
    impact = simulate_disruption(graph, "proj-monte-alto", as_of_year=2027)
    hit = _find(impact, "fac-caremag-lacq")
    classes = [a.key.evidence_class for a in hit.alternatives]
    assert classes == sorted(classes)
    automated = [a for a in hit.alternatives if a.key.evidence_class == 1]
    assert all(a.provenance.type is ProvenanceType.AUTOMATED for a in automated)


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


def test_results_are_sorted_by_key(graph: SupplyGraph) -> None:
    impact = simulate_disruption(graph, "proj-browns-range", as_of_year=2028)
    for hit in impact.impacted:
        keys = [a.key for a in hit.alternatives]
        assert keys == sorted(keys)
