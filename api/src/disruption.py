"""Simulate a mine going down and rank what could feed the plants it fed.

Answers three questions over the loaded graph: which Dy/Tb refining nodes lose
feed, how exposed each one is, and which other sources could be rerouted in.

What the ranking is, and is not
-------------------------------
Candidates are ordered by ``CandidateScore``: each of six factors is normalised
to [0, 1] with 1 as best, weighted, and renormalised over the weights actually
in play, giving 0-100 where higher is better. ``RankingKey`` is still built and
still returned - it breaks exact score ties, and it records the lexicographic
order the score replaced.

The weights are invented. There is no principled exchange rate between a
qualification tier, a month and a tonne, and no amount of tuning creates one, so
``DEFAULT_WEIGHTS`` is a stated editorial position carrying a version string
rather than a derived result. Two consequences follow, and both are load-bearing:

* **The score is not the lexicographic key rescaled.** Reproducing that key
  exactly would need each factor's smallest step to outweigh everything beneath
  it - weights spanning four orders of magnitude, and unreachable at any spread
  while ``shortfall`` is continuous. A weighted run therefore *will* order some
  pairs differently, most visibly by letting strength elsewhere outweigh
  ``evidence_class``, which the key treated as absolute.
* **Every score can be taken apart.** ``CandidateScore.factors`` carries each
  factor's raw value, its normalised value, its weight and its contribution in
  points of the final score, and those contributions sum to the score. So the
  composite hides nothing the key exposed. ``FactorScore.known`` marks the
  factors where a fallback stood in for data the graph does not hold.

Two limits worth stating before anyone acts on the output:

* **Commercial foreclosure is invisible here.** JOGMEC's right of first refusal
  over all Lofdal production, and Carina's designation to Aclara's own Project
  Dynamo, live in edge ``note`` prose. Nothing machine-readable expresses them,
  so both nodes will rank higher than they deserve until ``Relationship`` grows
  a structured exclusivity field. ``AlternativeFeed.note`` is passed through
  verbatim so a reader can catch what the sort cannot.
* **Quantities are not on one basis.** Mine figures are contained metal in a
  shipped product; facility figures are separated-oxide nameplate. No recovery
  factor exists anywhere in the graph, so a coverage ratio is an upper bound.
  ``FeedQuantity.basis`` records where in the chain each number was struck;
  ``QuantityBasis.SEPARATED_OXIDE`` is never inferred, because the one node on
  that basis (Wimmera, which reports oxide *sold* rather than contained) is
  distinguishable only from prose. Add ``basis`` to ``ProductionFigure`` to fix
  it properly.
"""

from collections.abc import Collection, Mapping
from dataclasses import dataclass
from enum import StrEnum
from math import fsum

from src.feed_matching import UNCRACKED_HOSTS
from src.graph import SupplyGraph
from src.models import (
    Attested,
    Confidence,
    HostMineral,
    MaterialCategory,
    OperatingStatus,
    ProcessingFacility,
    Project,
    Provenance,
    ProvenanceType,
    QualificationTier,
    Relationship,
    RelationshipStatus,
    RelationshipType,
)


class QuantityBasis(StrEnum):
    """Where in the chain a tonnage was struck. Two numbers on different bases
    are not comparable without a recovery factor the graph does not carry."""

    #: Separated oxide, sold. Never inferred - see the module docstring.
    SEPARATED_OXIDE = "SEPARATED_OXIDE"
    #: Contained in a carbonate or leach product; separation losses remain.
    CONTAINED_IN_MREC = "CONTAINED_IN_MREC"
    #: Contained in a mineral concentrate; cracking, leaching and separation remain.
    CONTAINED_IN_CONCENTRATE = "CONTAINED_IN_CONCENTRATE"
    #: A life-of-mine total. Not a rate, and not annualisable - ``Project`` has
    #: no mine-life field, so Browns Range's 11-year life exists only in prose.
    LIFE_OF_MINE_TOTAL = "LIFE_OF_MINE_TOTAL"
    UNKNOWN = "UNKNOWN"


#: Alignment ordering. An unassessed country sorts *with* NEUTRAL rather than
#: below it: Malawi carries no alignment at all, and Kangankunde is a contracted
#: Eneabba feed that a null must not bury. ``AlternativeFeed.alignment_known``
#: distinguishes the two.
ALIGNMENT_RANK: dict[str | None, int] = {
    "DOMESTIC": 0,
    "ALLY": 1,
    "PARTNER": 2,
    "NEUTRAL": 3,
    None: 3,
    "ADVERSARY": 4,
}

#: Upper bound in months for each time-to-flow bucket. Raw lead months are a
#: modelling heuristic the seed data is explicit about, never a disclosed lead
#: time, so they are bucketed rather than sorted on directly.
TIME_BUCKETS: tuple[int, ...] = (0, 6, 12, 24)
TIME_BUCKET_UNKNOWN = len(TIME_BUCKETS) + 1

#: Statuses under which an asset can ship now. Anything else needs a stated
#: start year; absent one, readiness is unknown rather than guessed.
READY_STATUSES = frozenset({OperatingStatus.OPERATING, OperatingStatus.COMMISSIONING})

_TIER_RANK = {
    QualificationTier.INFEASIBLE: 0,
    QualificationTier.PLAUSIBLE: 1,
    QualificationTier.FEED_ENVELOPE: 2,
    QualificationTier.QUALIFIED: 3,
}
_CONFIDENCE_RANK = {Confidence.HIGH: 0, Confidence.MEDIUM: 1, Confidence.LOW: 2, None: 3}
_COMMITTING_STATUSES = frozenset(
    {RelationshipStatus.OBSERVED, RelationshipStatus.CONTRACTED, RelationshipStatus.PLANNED}
)


class ScoreFactor(StrEnum):
    """The axes a candidate is scored on.

    ``source_id`` is deliberately not among them. It breaks exact ties so that
    orderings stay stable and testable, and a tiebreak that contributed points
    would be scoring candidates on the spelling of their id.
    """

    EVIDENCE = "evidence"
    TIME_TO_FLOW = "time_to_flow"
    ALIGNMENT = "alignment"
    COVERAGE = "coverage"
    COMMITMENT = "commitment"
    CONFIDENCE = "confidence"


#: Bumped whenever a weight moves, so a stored response can be read back against
#: the policy that produced it rather than against today's defaults.
WEIGHTS_VERSION = "v1-balanced"

#: An editorial position, not a derived result - see the module docstring.
#: Feasibility (when it can flow, how much of the gap it fills) carries more than
#: half the weight. ``EVIDENCE`` is deliberately no longer absolute, which is the
#: single largest behavioural difference from the lexicographic key.
DEFAULT_WEIGHTS: dict[ScoreFactor, float] = {
    ScoreFactor.TIME_TO_FLOW: 0.30,
    ScoreFactor.COVERAGE: 0.25,
    ScoreFactor.EVIDENCE: 0.20,
    ScoreFactor.ALIGNMENT: 0.10,
    ScoreFactor.COMMITMENT: 0.10,
    ScoreFactor.CONFIDENCE: 0.05,
}

#: Where an unsized candidate scores on coverage. 0.5 preserves the rule the
#: lexicographic key enforced - unsized outranks any *known* partial, because
#: Browns Range is unsized only through a life-of-mine disclosure and is
#: plausibly the largest heavy feed in the graph. Scoring also prices that rule
#: for the first time: a candidate covering 99% of the gap now scores just under
#: a complete unknown. Moving this is a judgement about what a missing tonnage
#: means, not a tuning knob.
UNSIZED_COVERAGE_SCORE = 0.5

#: Reported precision for scores and contributions. Rounding is what makes an
#: exact tie exact - without it two indistinguishable candidates can differ by
#: 1e-16 and present as ranked.
_SCORE_DP = 6

#: Coverage rank as a label, shared with the API layer so the engine and the
#: schema cannot drift on what a rank means.
COVERAGE_LABEL: dict[int, str] = {0: "COVERS", 1: "UNSIZED", 2: "PARTIAL"}

#: One label per time bucket, including the unknown bucket at the end.
_TIME_LABELS: tuple[str, ...] = (
    "IMMEDIATE",
    "WITHIN_6M",
    "WITHIN_12M",
    "WITHIN_24M",
    "BEYOND_24M",
    "UNKNOWN",
)

_MAX_ALIGNMENT_RANK = max(ALIGNMENT_RANK.values())
_MAX_CONFIDENCE_RANK = max(_CONFIDENCE_RANK.values())


@dataclass(frozen=True)
class FeedQuantity:
    """A Dy+Tb tonnage together with where it was struck and what it rests on."""

    tonnes: float
    basis: QuantityBasis
    provenance: Provenance
    caveats: tuple[str, ...] = ()

    @property
    def is_annual_rate(self) -> bool:
        return self.basis is not QuantityBasis.LIFE_OF_MINE_TOTAL


@dataclass(frozen=True, order=True)
class RankingKey:
    """Lexicographic sort key. Lower is better in every field."""

    #: 0 curated, 1 AUTOMATED. Outermost because the inferred layer is five times
    #: the curated one and describes itself as "not evidence"; letting a generated
    #: row outrank a hand-read one inverts the rule the generator enforces.
    evidence_class: int
    #: Readiness gap plus qualification lead, bucketed. Feasibility before preference.
    time_bucket: int
    #: Country alignment. A preference, so it sits below both feasibility keys -
    #: only two mines in the graph are DOMESTIC, and ranking on it any higher
    #: floats an exploration-stage project above routes that can flow now.
    alignment_rank: int
    #: 0 covers the gap, 1 unsized, 2 known partial. Unknown sorts between them
    #: rather than as zero: Browns Range is unsized only because its disclosure is
    #: life-of-mine, and it is plausibly the largest heavy feed here.
    coverage_rank: int
    #: 1 - coverage, within ``coverage_rank`` 2 only.
    shortfall: float
    #: 0 uncommitted, 1 already contracted elsewhere. Ordinal because edges carry
    #: no allocated tonnage, so free volume cannot be computed.
    committed: int
    confidence: int
    #: Deterministic tiebreak, so orderings are stable and testable.
    source_id: str


@dataclass(frozen=True)
class FactorScore:
    """One factor's part of a score, with everything needed to check it."""

    factor: ScoreFactor
    #: The ordinal or measure the normalisation was taken from. ``None`` where
    #: the graph disclosed nothing to take it from.
    raw: float | None
    #: Display form of ``raw`` - "PARTNER", "WITHIN_12M", "PARTIAL".
    raw_label: str
    #: [0, 1], 1 is best. One direction on every factor, so a reader never has to
    #: remember which way a particular axis runs.
    normalized: float
    weight: float
    #: Points of the final score. Contributions sum to ``CandidateScore.value``.
    contribution: float
    #: Points this factor would have contributed at ``normalized`` 1.0, so a
    #: reader can see what was available as well as what was earned.
    max_contribution: float
    #: False where a fallback stood in for data the graph does not hold. The
    #: score still moves on it; it is just not resting on a disclosure.
    known: bool
    detail: str | None = None

    @property
    def excluded(self) -> bool:
        return self.weight == 0.0


@dataclass(frozen=True)
class CandidateScore:
    """A composite score and the factors that produced it."""

    #: 0-100, higher is better.
    value: float
    #: Every factor in ``ScoreFactor`` order, excluded ones included at weight
    #: zero. Dropping them would leave a client unable to tell a factor that was
    #: excluded from one that was never computed.
    factors: tuple[FactorScore, ...]
    policy_version: str

    def factor(self, factor: ScoreFactor) -> FactorScore:
        return next(f for f in self.factors if f.factor is factor)


@dataclass(frozen=True)
class ScoringPolicy:
    """The weights a run actually used, and what it dropped.

    Scores are renormalised over ``total_weight``, so excluding a factor keeps
    the 0-100 scale rather than shrinking it. Two runs under different policies
    are on the same scale but are not the same measurement, which is why
    ``version`` and ``excluded`` are carried on the result.
    """

    #: Every factor in declaration order, excluded ones at 0.0. A tuple rather
    #: than a dict so the policy stays hashable like the rows that carry it.
    weights: tuple[tuple[ScoreFactor, float], ...]
    excluded: tuple[ScoreFactor, ...]
    version: str

    @property
    def total_weight(self) -> float:
        return fsum(w for _, w in self.weights)

    def weight_of(self, factor: ScoreFactor) -> float:
        return next((w for f, w in self.weights if f is factor), 0.0)


def _as_factor(value: object) -> ScoreFactor:
    try:
        return ScoreFactor(value)
    except ValueError:
        raise ValueError(f"unknown score factor {value!r}") from None


def build_scoring_policy(
    exclude_factors: Collection[ScoreFactor | str] = (),
    weights: Mapping[ScoreFactor | str, float] | None = None,
) -> ScoringPolicy:
    """Resolve caller overrides into the weights a run will use.

    ``weights`` is merged over ``DEFAULT_WEIGHTS`` rather than replacing it, so a
    caller can move one axis without restating the rest. Excluding a factor and
    weighting it zero are the same arithmetic; they are kept apart because only
    the first states an intent the result can echo back.
    """
    excluded_set = {_as_factor(f) for f in exclude_factors}
    merged = dict(DEFAULT_WEIGHTS)
    for factor, weight in (weights or {}).items():
        if weight < 0:
            raise ValueError(f"weight for {factor} must not be negative, got {weight}")
        merged[_as_factor(factor)] = float(weight)
    for factor in excluded_set:
        merged[factor] = 0.0
    resolved = tuple((f, merged[f]) for f in ScoreFactor)
    if fsum(w for _, w in resolved) <= 0:
        raise ValueError("no factors left to score on; every weight is zero or excluded")
    return ScoringPolicy(
        weights=resolved,
        excluded=tuple(f for f in ScoreFactor if f in excluded_set),
        version=WEIGHTS_VERSION if not weights else f"{WEIGHTS_VERSION}+custom",
    )


@dataclass(frozen=True)
class _Measured:
    """A factor after normalisation and before weights."""

    factor: ScoreFactor
    normalized: float
    raw: float | None
    raw_label: str
    known: bool
    detail: str | None = None


def _coverage_measure(key: RankingKey) -> tuple[float, float | None, bool, str | None]:
    """Collapse ``coverage_rank`` and ``shortfall`` onto one axis.

    The two are entangled - ``shortfall`` only means anything within rank 2 - so
    they score as one factor. ``raw`` is the fraction of the gap covered, capped
    at 1.0: rank 0 says the candidate clears the gap, not by how much.
    """
    if key.coverage_rank == 0:
        return 1.0, 1.0, True, None
    if key.coverage_rank == 1:
        return (
            UNSIZED_COVERAGE_SCORE,
            None,
            False,
            "tonnage cannot be sized against the loss; scored between COVERS and "
            "every known partial rather than as zero",
        )
    return UNSIZED_COVERAGE_SCORE * (1.0 - key.shortfall), 1.0 - key.shortfall, True, None


def _measure(
    key: RankingKey,
    alignment: str | None,
    months: int | None,
    confidence: Confidence | None,
) -> tuple[_Measured, ...]:
    """Normalise every axis to [0, 1] with 1 as best.

    Ordinals are read off ``RankingKey`` rather than recomputed, so the score and
    the key can never disagree about what a candidate looked like.
    """
    coverage_normal, coverage_raw, coverage_known, coverage_detail = _coverage_measure(key)
    return (
        _Measured(
            ScoreFactor.EVIDENCE,
            1.0 - key.evidence_class,
            float(key.evidence_class),
            "CURATED" if key.evidence_class == 0 else "AUTOMATED",
            True,
        ),
        _Measured(
            ScoreFactor.TIME_TO_FLOW,
            1.0 - key.time_bucket / TIME_BUCKET_UNKNOWN,
            float(months) if months is not None else None,
            _TIME_LABELS[key.time_bucket],
            months is not None,
            None
            if months is not None
            else "no stated start year or qualification lead; scored below every known bucket",
        ),
        _Measured(
            ScoreFactor.ALIGNMENT,
            1.0 - key.alignment_rank / _MAX_ALIGNMENT_RANK,
            float(key.alignment_rank),
            alignment or "UNASSESSED",
            alignment is not None,
            None
            if alignment is not None
            else "country carries no alignment assessment; scored with NEUTRAL, not below it",
        ),
        _Measured(
            ScoreFactor.COVERAGE,
            coverage_normal,
            coverage_raw,
            COVERAGE_LABEL[key.coverage_rank],
            coverage_known,
            coverage_detail,
        ),
        _Measured(
            ScoreFactor.COMMITMENT,
            1.0 - key.committed,
            float(key.committed),
            "UNCOMMITTED" if key.committed == 0 else "COMMITTED_ELSEWHERE",
            True,
        ),
        _Measured(
            ScoreFactor.CONFIDENCE,
            1.0 - key.confidence / _MAX_CONFIDENCE_RANK,
            float(key.confidence),
            confidence.value if confidence is not None else "UNSTATED",
            confidence is not None,
            None
            if confidence is not None
            else "no assertion confidence stated; scored at the floor",
        ),
    )


def _score(policy: ScoringPolicy, measured: tuple[_Measured, ...]) -> CandidateScore:
    """Weight, renormalise and round.

    Contributions are rounded before they are summed, so the reported
    contributions add up to the reported score exactly rather than to within a
    float epsilon of it.
    """
    total = policy.total_weight
    factors = tuple(
        FactorScore(
            factor=m.factor,
            raw=m.raw,
            raw_label=m.raw_label,
            normalized=round(m.normalized, _SCORE_DP),
            weight=policy.weight_of(m.factor),
            contribution=round(100.0 * policy.weight_of(m.factor) * m.normalized / total, _SCORE_DP),
            max_contribution=round(100.0 * policy.weight_of(m.factor) / total, _SCORE_DP),
            known=m.known,
            detail=m.detail,
        )
        for m in measured
    )
    return CandidateScore(
        value=round(fsum(f.contribution for f in factors), _SCORE_DP),
        factors=factors,
        policy_version=policy.version,
    )


@dataclass(frozen=True)
class AlternativeFeed:
    source_id: str
    relationship_id: str
    qualification: QualificationTier | None
    qualification_lead_months: int | None
    status: RelationshipStatus
    provenance: Provenance
    alignment: str | None
    alignment_known: bool
    available_feed: FeedQuantity | None
    months_to_flow: int | None
    readiness_known: bool
    already_committed_to: tuple[str, ...]
    basis_comparable: bool
    #: What ordered this row. Read with ``key``, which broke any exact tie.
    score: CandidateScore
    key: RankingKey
    note: str | None = None


@dataclass(frozen=True)
class FacilityImpact:
    facility_id: str
    hops: int
    via_relationship_ids: tuple[str, ...]
    nameplate_dytb_tpa: float | None
    operating_status: OperatingStatus
    sole_source: bool
    remaining_supplies_in: int
    alternatives: tuple[AlternativeFeed, ...]


@dataclass(frozen=True)
class DisruptionImpact:
    mine_id: str
    as_of_year: int
    severity: float
    lost_feed: FeedQuantity | None
    impacted: tuple[FacilityImpact, ...]
    #: The weights every score in ``impacted`` was computed under. Weights are an
    #: input now, so a stored result is not reproducible without them.
    scoring: ScoringPolicy
    warnings: tuple[str, ...] = ()


def _superseding(entries: list[tuple[str, float, int | None]], as_of_year: int) -> dict[str, float]:
    """Latest in-force tonnage per material.

    Entries for one material supersede rather than accumulate - White Mesa holds
    Dy at 120 t (2027) and 288 t (2029) for the same circuit. Take the newest
    entry in force by ``as_of_year``, and on a tie the larger figure, which picks
    Mountain Pass's 200 t nameplate over the 120 t own-feed estimate sharing 2026.
    """
    best: dict[str, tuple[int, float]] = {}
    for material_id, tonnes, target_year in entries:
        if target_year is not None and target_year > as_of_year:
            continue
        rank = (target_year or 0, tonnes)
        if material_id not in best or rank > best[material_id]:
            best[material_id] = rank
    return {k: v[1] for k, v in best.items()}


def _combine_dytb(totals: dict[str, float]) -> float | None:
    """Dy+Tb from the superseded figures, never double-counting a split.

    ``mat-dytb-combined`` is the disclosed number that the per-element entries
    were derived *from*, so it wins outright where present.
    """
    if "mat-dytb-combined" in totals:
        return totals["mat-dytb-combined"]
    parts = [totals[m] for m in ("mat-dy-oxide", "mat-tb-oxide") if m in totals]
    if parts:
        return sum(parts)
    return totals.get("mat-hreo")


#: Chain stage implied by a shipped material's category, where its host is not
#: disclosed. Coarser than the host reading but still sound: category fixes how
#: far along a stream is, even when it says nothing about the front end needed.
_CATEGORY_BASIS = {
    MaterialCategory.ORE: QuantityBasis.CONTAINED_IN_CONCENTRATE,
    MaterialCategory.CONCENTRATE: QuantityBasis.CONTAINED_IN_CONCENTRATE,
    MaterialCategory.CARBONATE: QuantityBasis.CONTAINED_IN_MREC,
}


def _shipped_basis(graph: SupplyGraph, products: tuple[Attested, ...]) -> QuantityBasis:
    """Infer where a mine's contained figure sits from the form it ships.

    A stream in an uncracked host still has cracking, leaching and separation
    ahead of it; an ion-adsorbed or already-cracked one has only separation. A
    mine shipping both is read conservatively as the less-processed of the two.
    An undisclosed host falls back to the material's category - Monte Alto ships
    ``mat-hre-concentrate`` with no host stated, which is still a concentrate.
    """
    hosts = {a.value.host_mineral for a in products}
    if not hosts:
        return QuantityBasis.UNKNOWN
    if hosts & UNCRACKED_HOSTS:
        return QuantityBasis.CONTAINED_IN_CONCENTRATE
    if hosts == {HostMineral.UNDISCLOSED}:
        categories = {
            graph.materials[a.value.material_id].category
            for a in products
            if a.value.material_id in graph.materials
        }
        found = {_CATEGORY_BASIS[c] for c in categories if c in _CATEGORY_BASIS}
        if found == {QuantityBasis.CONTAINED_IN_CONCENTRATE}:
            return QuantityBasis.CONTAINED_IN_CONCENTRATE
        if found == {QuantityBasis.CONTAINED_IN_MREC}:
            return QuantityBasis.CONTAINED_IN_MREC
        return QuantityBasis.UNKNOWN
    return QuantityBasis.CONTAINED_IN_MREC


def _mine_feed(graph: SupplyGraph, project: Project, as_of_year: int) -> FeedQuantity | None:
    """Annual contained Dy+Tb for a mine, falling back to a life-of-mine total."""
    annual = _combine_dytb(
        _superseding(
            [
                (a.value.material_id, a.value.tonnes, a.value.target_year)
                for a in project.planned_production
                if a.value.period.value == "ANNUAL"
            ],
            as_of_year,
        )
    )
    figures = {a.value.material_id: a for a in project.planned_production}
    provenance = next(
        (figures[m].provenance for m in ("mat-dytb-combined", "mat-dy-oxide", "mat-hreo") if m in figures),
        Provenance(type=ProvenanceType.UNKNOWN),
    )
    if annual is not None:
        basis = _shipped_basis(graph, project.products)
        caveats = (
            "basis inferred from the shipped product form, not declared on the figure",
        )
        if basis is QuantityBasis.UNKNOWN:
            caveats += ("shipped form does not fix a chain stage",)
        return FeedQuantity(annual, basis, provenance, caveats)

    lom = _combine_dytb(
        _superseding(
            [
                (a.value.material_id, a.value.tonnes, a.value.target_year)
                for a in project.planned_production
                if a.value.period.value == "LIFE_OF_MINE"
            ],
            as_of_year,
        )
    )
    if lom is None:
        return None
    return FeedQuantity(
        lom,
        QuantityBasis.LIFE_OF_MINE_TOTAL,
        provenance,
        ("life-of-mine total; Project carries no mine-life field, so no annual rate is derivable",),
    )


def _facility_capacity(facility: ProcessingFacility, as_of_year: int) -> float | None:
    return _combine_dytb(
        _superseding(
            [
                (a.value.material_id, a.value.tonnes_per_year, a.value.target_year)
                for a in facility.capacities
            ],
            as_of_year,
        )
    )


def _source_feed(graph: SupplyGraph, source_id: str, as_of_year: int) -> FeedQuantity | None:
    """Available Dy+Tb from a candidate, which may be a mine or an upstream plant."""
    if source_id in graph.projects:
        return _mine_feed(graph, graph.projects[source_id], as_of_year)
    facility = graph.facilities.get(source_id)
    if facility is None:
        return None
    tonnes = _facility_capacity(facility, as_of_year)
    if tonnes is None:
        return None
    return FeedQuantity(
        tonnes,
        QuantityBasis.SEPARATED_OXIDE,
        Provenance(type=ProvenanceType.INFERRED),
        ("upstream plant capacity, not mine output",),
    )


def _years_to_ready(graph: SupplyGraph, source_id: str, as_of_year: int) -> int | None:
    """Years until an asset can ship, or ``None`` where it cannot be established.

    Operating and commissioning assets ship now. Everything else needs a stated
    start year; most planned projects have none, and guessing one from
    development stage would invent a number the graph does not hold.
    """
    node = graph.projects.get(source_id) or graph.facilities.get(source_id)
    if node is None:
        return None
    if node.operating_status.value in READY_STATUSES:
        return 0
    start = getattr(node, "expected_production_start", None) or getattr(node, "expected_start", None)
    if start is None:
        return None
    return max(0, start.value - as_of_year)


def _effective_tier(edge: Relationship) -> QualificationTier | None:
    """Technical tier for an edge, including flows that never stated one.

    A ``SUPPLIES`` edge that is observed or contracted demonstrates the route
    works whether or not anyone recorded a tier for it.
    """
    if edge.qualification is not None:
        return edge.qualification
    if edge.type is RelationshipType.SUPPLIES and edge.status in (
        RelationshipStatus.OBSERVED,
        RelationshipStatus.CONTRACTED,
    ):
        return QualificationTier.QUALIFIED
    return None


def _months_to_flow(
    graph: SupplyGraph, edge: Relationship, source_id: str, as_of_year: int
) -> tuple[int | None, bool]:
    """Readiness gap plus qualification lead, and whether readiness was known.

    ``qualification_lead_months`` is null in two unrelated situations: on a
    QUALIFIED edge it means no qualification work remains, and on every one of
    the 218 automated edges it means nobody has estimated it. Resolving that by
    tier is what keeps a generated row out of the immediate bucket.
    """
    years = _years_to_ready(graph, source_id, as_of_year)
    tier = _effective_tier(edge)
    if edge.qualification_lead_months is not None:
        lead = edge.qualification_lead_months
    elif tier is QualificationTier.QUALIFIED:
        lead = 0
    else:
        lead = None
    if years is None or lead is None:
        return None, years is not None
    return years * 12 + lead, True


def _time_bucket(months: int | None) -> int:
    if months is None:
        return TIME_BUCKET_UNKNOWN
    for index, upper in enumerate(TIME_BUCKETS):
        if months <= upper:
            return index
    return len(TIME_BUCKETS)


def _committed_elsewhere(graph: SupplyGraph, source_id: str, facility_id: str) -> tuple[str, ...]:
    return tuple(
        edge.to_id or edge.id
        for edge in graph.supplies_from.get(source_id, ())
        if edge.to_id != facility_id and edge.status in _COMMITTING_STATUSES
    )


def _coverage(gap: float | None, available: FeedQuantity | None) -> tuple[int, float]:
    if gap is None or available is None or not available.is_annual_rate:
        return 1, 0.0
    if available.tonnes >= gap:
        return 0, 0.0
    return 2, 1.0 - (available.tonnes / gap) if gap else 0.0


def _candidate_edges(
    graph: SupplyGraph,
    facility_id: str,
    excluded: frozenset[str],
    min_qualification: QualificationTier,
) -> list[Relationship]:
    floor = _TIER_RANK[min_qualification]
    seen: set[str] = set()
    out: list[Relationship] = []
    for edge in (
        *graph.supplies_to.get(facility_id, ()),
        *graph.can_supply_to.get(facility_id, ()),
        *graph.inferred_to.get(facility_id, ()),
    ):
        if edge.from_id in excluded or not graph.is_asset(edge.from_id) or edge.from_id in seen:
            continue
        tier = _effective_tier(edge)
        if tier is QualificationTier.INFEASIBLE:
            continue
        if tier is not None and _TIER_RANK[tier] < floor:
            continue
        seen.add(edge.from_id)
        out.append(edge)
    return out


def _rank_alternatives(
    graph: SupplyGraph,
    facility_id: str,
    excluded: frozenset[str],
    gap: float | None,
    lost_basis: QuantityBasis | None,
    as_of_year: int,
    min_qualification: QualificationTier,
    policy: ScoringPolicy,
) -> tuple[AlternativeFeed, ...]:
    rows: list[AlternativeFeed] = []
    for edge in _candidate_edges(graph, facility_id, excluded, min_qualification):
        source_id = edge.from_id
        available = _source_feed(graph, source_id, as_of_year)
        months, readiness_known = _months_to_flow(graph, edge, source_id, as_of_year)
        coverage_rank, shortfall = _coverage(gap, available)
        alignment = graph.alignment_of(source_id)
        committed = _committed_elsewhere(graph, source_id, facility_id)
        key = RankingKey(
            evidence_class=1 if edge.provenance.type is ProvenanceType.AUTOMATED else 0,
            time_bucket=_time_bucket(months),
            alignment_rank=ALIGNMENT_RANK.get(alignment, ALIGNMENT_RANK[None]),
            coverage_rank=coverage_rank,
            shortfall=shortfall,
            committed=1 if committed else 0,
            confidence=_CONFIDENCE_RANK.get(edge.provenance.assertion_confidence, 3),
            source_id=source_id,
        )
        score = _score(policy, _measure(key, alignment, months, edge.provenance.assertion_confidence))
        rows.append(
            AlternativeFeed(
                source_id=source_id,
                relationship_id=edge.id,
                qualification=edge.qualification,
                qualification_lead_months=edge.qualification_lead_months,
                status=edge.status,
                provenance=edge.provenance,
                alignment=alignment,
                alignment_known=alignment is not None,
                available_feed=available,
                months_to_flow=months,
                readiness_known=readiness_known,
                already_committed_to=committed,
                basis_comparable=(
                    available is not None and lost_basis is not None and available.basis is lost_basis
                ),
                score=score,
                key=key,
                note=edge.note,
            )
        )
    # Score first, the lexicographic key only where scores are exactly equal, so
    # an ordering stays deterministic without the tiebreak ever earning points.
    return tuple(sorted(rows, key=lambda r: (-r.score.value, r.key)))


def _dependent_nodes(graph: SupplyGraph, mine_id: str, max_hops: int) -> frozenset[str]:
    """Assets that lose their own supply when ``mine_id`` does.

    An intermediate plant fed solely by the disrupted mine is not a reroute
    option and is not remaining supply - it is part of the outage. Kalgoorlie is
    the case: its only feed is Mt Weld, so a Mt Weld disruption that counted
    Kalgoorlie as an alternative into Lynas Malaysia would be offering the
    failed path back as its own remedy. A plant with any surviving feed is left
    alone, so this never over-prunes a genuinely diversified intermediate.
    """
    dependent = {mine_id}
    for _ in range(max_hops):
        grown = False
        for facility_id in graph.facilities:
            if facility_id in dependent or graph.is_dytb_refiner(facility_id):
                continue
            inbound = graph.supplies_to.get(facility_id, ())
            if inbound and all(e.from_id in dependent for e in inbound):
                dependent.add(facility_id)
                grown = True
        if not grown:
            break
    return frozenset(dependent)


def _walk_downstream(
    graph: SupplyGraph, mine_id: str, max_hops: int
) -> list[tuple[str, int, tuple[str, ...]]]:
    """Breadth-first over SUPPLIES to the first Dy/Tb refiner on each path.

    Not every mine reaches one in a single hop: Mt Weld ships concentrate to
    Kalgoorlie, which makes MREC, and only Lynas Malaysia behind it separates
    Dy and Tb. Traversal stops at the first Dy/Tb node on a path - beyond it
    the loss is no longer an immediate feed effect.
    """
    found: dict[str, tuple[int, tuple[str, ...]]] = {}
    frontier = [(mine_id, 0, ())]
    visited = {mine_id}
    while frontier:
        node_id, depth, path = frontier.pop(0)
        if depth >= max_hops:
            continue
        for edge in graph.supplies_from.get(node_id, ()):
            target = edge.to_id
            if target is None or not graph.is_asset(target):
                continue
            trail = path + (edge.id,)
            if graph.is_dytb_refiner(target):
                if target not in found or depth + 1 < found[target][0]:
                    found[target] = (depth + 1, trail)
                continue
            if target not in visited:
                visited.add(target)
                frontier.append((target, depth + 1, trail))
    return [(fid, hops, trail) for fid, (hops, trail) in found.items()]


def simulate_disruption(
    graph: SupplyGraph,
    mine_id: str,
    *,
    as_of_year: int,
    severity: float = 1.0,
    max_hops: int = 3,
    min_qualification: QualificationTier = QualificationTier.PLAUSIBLE,
    exclude_factors: Collection[ScoreFactor | str] = (),
    weights: Mapping[ScoreFactor | str, float] | None = None,
) -> DisruptionImpact:
    """Model a mine losing output and rank what could take its place.

    ``as_of_year`` is required because capacities are staged and supersede one
    another: White Mesa's Dy+Tb nameplate is 140 t in 2027 and 368 t in 2029, so
    any share-of-nameplate figure is undefined without a year. ``severity``
    scales the lost tonnage, ``max_hops`` bounds the downstream walk, and
    ``min_qualification`` prunes the reroute space - ``INFEASIBLE`` edges are
    always dropped, being recorded precisely to prune it.

    ``exclude_factors`` drops factors from the score and ``weights`` overrides
    individual ones; both renormalise over what is left, so scores stay on 0-100
    whatever is in play. The policy actually used comes back on the result.

    Raises ``KeyError`` if ``mine_id`` names no project in the graph, and
    ``ValueError`` for a severity outside [0, 1] or a policy scoring on nothing.
    """
    if mine_id not in graph.projects:
        raise KeyError(f"unknown mine {mine_id!r}")
    if not 0.0 <= severity <= 1.0:
        raise ValueError(f"severity must be within [0, 1], got {severity}")
    policy = build_scoring_policy(exclude_factors, weights)

    project = graph.projects[mine_id]
    feed = _mine_feed(graph, project, as_of_year)
    lost = (
        FeedQuantity(feed.tonnes * severity, feed.basis, feed.provenance, feed.caveats)
        if feed
        else None
    )
    gap = lost.tonnes if lost and lost.is_annual_rate else None

    warnings: list[str] = []
    if lost is None:
        warnings.append(f"{mine_id} discloses no Dy/Tb figure; impact is structural only")
    elif not lost.is_annual_rate:
        warnings.append(
            f"{mine_id} discloses only a life-of-mine total, so coverage cannot be computed "
            "and every alternative is returned unsized"
        )

    dependent = _dependent_nodes(graph, mine_id, max_hops)
    impacted: list[FacilityImpact] = []
    for facility_id, hops, trail in _walk_downstream(graph, mine_id, max_hops):
        facility = graph.facilities[facility_id]
        remaining = [
            e for e in graph.supplies_to.get(facility_id, ()) if e.from_id not in dependent
        ]
        impacted.append(
            FacilityImpact(
                facility_id=facility_id,
                hops=hops,
                via_relationship_ids=trail,
                nameplate_dytb_tpa=_facility_capacity(facility, as_of_year),
                operating_status=facility.operating_status.value,
                sole_source=not remaining,
                remaining_supplies_in=len(remaining),
                alternatives=_rank_alternatives(
                    graph,
                    facility_id,
                    dependent,
                    gap,
                    lost.basis if lost else None,
                    as_of_year,
                    min_qualification,
                    policy,
                ),
            )
        )
    impacted.sort(key=lambda i: (i.hops, -(i.nameplate_dytb_tpa or 0.0), i.facility_id))

    unknown_readiness = sum(
        1 for i in impacted for a in i.alternatives if not a.readiness_known
    )
    if unknown_readiness:
        warnings.append(
            f"{unknown_readiness} candidate rows have no stated start year; readiness is "
            "unknown rather than estimated, so they fall to the unknown time bucket"
        )
    if any(not a.basis_comparable for i in impacted for a in i.alternatives):
        warnings.append(
            "some coverage ratios compare tonnages struck at different points in the chain; "
            "no recovery factor exists in the graph to reconcile them"
        )
    if policy.excluded:
        warnings.append(
            "scores exclude " + ", ".join(f.value for f in policy.excluded) + "; the remaining "
            "weights were renormalised, so these values sit on the same 0-100 scale as a "
            "default run but are not the same measurement"
        )

    return DisruptionImpact(
        mine_id=mine_id,
        as_of_year=as_of_year,
        severity=severity,
        lost_feed=lost,
        impacted=tuple(impacted),
        scoring=policy,
        warnings=tuple(warnings),
    )
