"""Maps ``src.disruption`` output onto the API schemas.

The engine returns frozen dataclasses holding ids; the console needs names and
coordinates too, and neither is on the dataclasses. Resolving that here keeps
``simulate_disruption`` free of presentation concerns and keeps the router thin.

Nothing is computed here that the engine does not already decide. ``rank`` is
the index of an already-sorted tuple, not a re-sort: ``RankingKey`` is
lexicographic over six ordinal fields, and re-deriving an order from the
serialised row would silently drop that.
"""

from src.disruption import (
    AlternativeFeed,
    _facility_capacity,
    DisruptionImpact,
    FacilityImpact,
    FeedQuantity,
    simulate_disruption,
)
from src.graph import SupplyGraph
from src.models import Coordinates, QualificationTier
from src.schemas import disruption as schemas


def _coords(value: Coordinates | None) -> schemas.Coordinates | None:
    if value is None:
        return None
    return schemas.Coordinates(lat=value.latitude, lon=value.longitude)


#: Fallback band for a graph that discloses no staged year at all, so the
#: slider still has something coherent to render.
_FALLBACK_RANGE = (2025, 2029)


def _earliest_year(graph: SupplyGraph, mine_id: str) -> int | None:
    """First year a mine is expected to produce, where one is disclosed.

    ``None`` covers two unrelated cases - an operating mine that needs no start
    year, and a planned one whose start nobody has stated - so a caller must
    read ``operating_status`` alongside it rather than treating null as "now".
    """
    project = graph.projects.get(mine_id)
    if project is None or project.expected_production_start is None:
        return None
    return project.expected_production_start.value


def year_range(graph: SupplyGraph) -> schemas.YearRange:
    """The band over which the graph says anything different.

    Every staged figure in the seed data carries a ``target_year``, and
    ``_superseding`` takes the latest one in force; outside the band the answer
    stops changing. Computed rather than hardcoded so it tracks the data.
    """
    years: set[int] = set()
    for project in graph.projects.values():
        if project.expected_production_start is not None:
            years.add(project.expected_production_start.value)
        years.update(
            a.value.target_year for a in project.planned_production if a.value.target_year
        )
    for facility in graph.facilities.values():
        if facility.expected_start is not None:
            years.add(facility.expected_start.value)
        years.update(a.value.target_year for a in facility.capacities if a.value.target_year)
    low, high = (min(years), max(years)) if years else _FALLBACK_RANGE
    # Default to the earliest year at which every staged capacity is in force,
    # so a first render is not silently missing nameplates.
    return schemas.YearRange(min_year=low, max_year=high, default_year=min(high, low + 2))


def _modelled_capacity(graph: SupplyGraph, as_of_year: int) -> dict[str, float]:
    """Disclosed Dy+Tb nameplate per Dy/Tb refiner, at ``as_of_year``.

    Plants that disclose nothing are absent rather than zero. That distinction
    is the whole point: the denominator built from this is a floor, so a share
    computed against it is an upper bound on the true share.
    """
    out: dict[str, float] = {}
    for facility_id, facility in graph.facilities.items():
        if not graph.is_dytb_refiner(facility_id):
            continue
        capacity = _facility_capacity(facility, as_of_year)
        if capacity:
            out[facility_id] = capacity
    return out


def _country_name(graph: SupplyGraph, country_id: str | None) -> str | None:
    country = graph.countries.get(country_id) if country_id else None
    return country.name if country else None


def _feed(feed: FeedQuantity | None) -> schemas.FeedQuantity | None:
    if feed is None:
        return None
    return schemas.FeedQuantity(
        tonnes=feed.tonnes,
        basis=feed.basis.value,
        is_annual_rate=feed.is_annual_rate,
        provenance=schemas.Provenance(
            type=feed.provenance.type.value,
            source_id=feed.provenance.source_id,
            assertion_confidence=(
                feed.provenance.assertion_confidence.value
                if feed.provenance.assertion_confidence
                else None
            ),
        ),
        caveats=list(feed.caveats),
    )


#: Coverage rank as the schema names it. ``_coverage`` in the engine returns 0
#: where the candidate covers the gap, 1 where it cannot be sized at all, and 2
#: where it is known to fall short.
_COVERAGE_LABEL = {0: "COVERS", 1: "UNSIZED", 2: "PARTIAL"}

#: RankingKey fields in their declared (lexicographic) order. Comparing two
#: keys left to right, the first that differs is the one that decided the order.
_KEY_FIELDS = (
    "evidence_class",
    "time_bucket",
    "alignment_rank",
    "coverage_rank",
    "shortfall",
    "committed",
    "confidence",
    "source_id",
)


def _decisive_factor(previous: AlternativeFeed | None, current: AlternativeFeed) -> str | None:
    """Which key field put ``current`` below ``previous``.

    The key is lexicographic, so the first field where the two differ is the
    whole reason for the order - there is no weighting to unpick. Falling
    through to ``source_id`` means the pair is tied on everything substantive
    and only the deterministic tiebreak separates them, which is a materially
    different statement from being ranked lower.
    """
    if previous is None:
        return None
    for field in _KEY_FIELDS:
        if getattr(previous.key, field) != getattr(current.key, field):
            return field
    return None


def _alternative(
    graph: SupplyGraph,
    alt: AlternativeFeed,
    rank: int,
    previous: AlternativeFeed | None = None,
) -> schemas.AlternativeFeed:
    decisive = _decisive_factor(previous, alt)
    return schemas.AlternativeFeed(
        rank=rank,
        source_id=alt.source_id,
        name=graph.name_of(alt.source_id),
        country_id=graph.country_of(alt.source_id),
        country_name=_country_name(graph, graph.country_of(alt.source_id)),
        coordinates=_coords(graph.coordinates_of(alt.source_id)),
        relationship_id=alt.relationship_id,
        evidence_class=alt.key.evidence_class,
        qualification=alt.qualification.value if alt.qualification else None,
        qualification_lead_months=alt.qualification_lead_months,
        status=alt.status.value,
        alignment=alt.alignment,
        alignment_known=alt.alignment_known,
        available_feed=_feed(alt.available_feed),
        months_to_flow=alt.months_to_flow,
        readiness_known=alt.readiness_known,
        basis_comparable=alt.basis_comparable,
        already_committed_to=list(alt.already_committed_to),
        note=alt.note,
        coverage=_COVERAGE_LABEL[alt.key.coverage_rank],
        # shortfall is 1 - coverage, and carries a value only on PARTIAL.
        covered_fraction=(
            1.0 - alt.key.shortfall if alt.key.coverage_rank == 2 else None
        ),
        decisive_factor=decisive,
        tied_with_previous=decisive == "source_id",
        decisive_against=previous.source_id if previous is not None else None,
    )


def _path(graph: SupplyGraph, mine_id: str, impact: FacilityImpact) -> list[schemas.PathNode]:
    """Mine first, affected plant last, walking the edges the traversal used.

    Rebuilt from ``via_relationship_ids`` rather than recomputed, so the drawn
    route is the route the engine actually took - including an intermediate like
    Kalgoorlie, which a mine-to-plant straight line would hide.
    """
    by_id = {e.id: e for e in graph.curated}
    node_ids = [mine_id]
    for rel_id in impact.via_relationship_ids:
        edge = by_id.get(rel_id)
        if edge is not None and edge.to_id is not None:
            node_ids.append(edge.to_id)
    out = []
    for node_id in node_ids:
        facility = graph.facilities.get(node_id)
        country_id = graph.country_of(node_id)
        out.append(
            schemas.PathNode(
                id=node_id,
                name=graph.name_of(node_id),
                facility_type=facility.facility_type.value if facility else None,
                operating_status=(
                    facility.operating_status.value.value if facility else None
                ),
                country_id=country_id,
                country_name=_country_name(graph, country_id),
                coordinates=_coords(graph.coordinates_of(node_id)),
            )
        )
    return out


def _facility(
    graph: SupplyGraph,
    mine_id: str,
    impact: FacilityImpact,
    limit: int | None,
    lost: FeedQuantity | None = None,
    modelled_total: float = 0.0,
) -> schemas.FacilityImpact:
    facility = graph.facilities[impact.facility_id]
    alternatives = impact.alternatives if limit is None else impact.alternatives[:limit]
    return schemas.FacilityImpact(
        facility_id=impact.facility_id,
        name=facility.name,
        facility_type=facility.facility_type.value,
        country_id=facility.country_id,
        country_name=_country_name(graph, facility.country_id),
        coordinates=_coords(graph.coordinates_of(impact.facility_id)),
        hops=impact.hops,
        via_relationship_ids=list(impact.via_relationship_ids),
        path=_path(graph, mine_id, impact),
        nameplate_dytb_tpa=impact.nameplate_dytb_tpa,
        operating_status=impact.operating_status.value,
        sole_source=impact.sole_source,
        remaining_supplies_in=impact.remaining_supplies_in,
        # Contained metal over separated-oxide nameplate, with no recovery
        # factor in the graph to reconcile them: an upper bound, not a ratio.
        share_of_nameplate=(
            lost.tonnes / impact.nameplate_dytb_tpa
            if lost is not None and lost.is_annual_rate and impact.nameplate_dytb_tpa
            else None
        ),
        share_of_modelled_capacity=(
            impact.nameplate_dytb_tpa / modelled_total
            if impact.nameplate_dytb_tpa and modelled_total
            else None
        ),
        alternatives=[
            # `alternatives` is a prefix of an already-sorted tuple, so the row
            # above in this list is the row above in the full ranking too.
            _alternative(graph, a, rank, alternatives[rank - 2] if rank > 1 else None)
            for rank, a in enumerate(alternatives, start=1)
        ],
    )


def _capacity_context(
    graph: SupplyGraph, result: DisruptionImpact, modelled: dict[str, float]
) -> schemas.CapacityContext:
    refiners_total = sum(1 for f in graph.facilities if graph.is_dytb_refiner(f))
    total = sum(modelled.values())
    affected = [i.facility_id for i in result.impacted]
    disclosed = [f for f in affected if f in modelled]
    affected_tpa = sum(modelled[f] for f in disclosed) if disclosed else None
    return schemas.CapacityContext(
        as_of_year=result.as_of_year,
        total_tpa=total,
        refiners_disclosing=len(modelled),
        refiners_total=refiners_total,
        affected_tpa=affected_tpa,
        # None, never 0.0: every affected plant being undisclosed means unsized
        # exposure, and a zero here would read as "no systemic weight".
        affected_share=(affected_tpa / total if affected_tpa and total else None),
        undisclosed_facility_ids=[f for f in affected if f not in modelled],
    )


def _response(graph: SupplyGraph, result: DisruptionImpact, limit: int | None) -> schemas.DisruptionResponse:
    modelled = _modelled_capacity(graph, result.as_of_year)
    modelled_total = sum(modelled.values())
    earliest = _earliest_year(graph, result.mine_id)
    before_start = earliest is not None and result.as_of_year < earliest
    warnings = list(result.warnings)
    if before_start:
        warnings.insert(
            0,
            f"{result.mine_id} is not expected to produce until {earliest}; at "
            f"{result.as_of_year} this disrupts output that does not exist yet",
        )
    return schemas.DisruptionResponse(
        mine_id=result.mine_id,
        mine_name=graph.name_of(result.mine_id),
        country_id=graph.country_of(result.mine_id),
        country_name=_country_name(graph, graph.country_of(result.mine_id)),
        coordinates=_coords(graph.coordinates_of(result.mine_id)),
        as_of_year=result.as_of_year,
        earliest_year=earliest,
        before_production_start=before_start,
        severity=result.severity,
        lost_feed=_feed(result.lost_feed),
        impacted=[
            _facility(graph, result.mine_id, i, limit, result.lost_feed, modelled_total)
            for i in result.impacted
        ],
        capacity_context=_capacity_context(graph, result, modelled),
        warnings=warnings,
    )


def get_disruption(
    graph: SupplyGraph,
    mine_id: str,
    *,
    as_of_year: int,
    severity: float = 1.0,
    max_hops: int = 3,
    min_qualification: QualificationTier = QualificationTier.PLAUSIBLE,
    limit: int | None = None,
) -> schemas.DisruptionResponse:
    """Simulate ``mine_id`` going down and shape the result for the API.

    Raises ``KeyError`` for an unknown mine and ``ValueError`` for a severity
    outside [0, 1]; the router turns both into HTTP status codes.
    """
    result = simulate_disruption(
        graph,
        mine_id,
        as_of_year=as_of_year,
        severity=severity,
        max_hops=max_hops,
        min_qualification=min_qualification,
    )
    return _response(graph, result, limit)


def list_mines(graph: SupplyGraph, *, as_of_year: int) -> list[schemas.MineSummary]:
    """Every project, flagged with whether disrupting it reaches a Dy/Tb refiner.

    The flag is the simulation itself rather than a cheaper proxy: reaching a
    refiner can take more than one hop, so an inspection of direct edges would
    wrongly report Mt Weld, which only reaches Lynas Malaysia through Kalgoorlie.
    """
    out = []
    for mine_id, project in graph.projects.items():
        impact = simulate_disruption(graph, mine_id, as_of_year=as_of_year)
        out.append(
            schemas.MineSummary(
                mine_id=mine_id,
                name=project.name,
                country_id=project.country_id,
                country_name=_country_name(graph, project.country_id),
                earliest_year=_earliest_year(graph, mine_id),
                operating_status=project.operating_status.value.value,
                coordinates=_coords(graph.coordinates_of(mine_id)),
                reaches_refiner=bool(impact.impacted),
            )
        )
    return sorted(out, key=lambda m: (not m.reaches_refiner, m.mine_id))
