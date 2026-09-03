"""First-pass route inference: which mines could feed which plants, on form alone.

This module answers exactly one question - *does the physical form of what a mine
ships fall inside what a plant has said it can take* - and it answers it from node
data only (``Project.products`` against ``ProcessingFacility.accepted_feeds``).
It never reads the curated edge layer.

What it deliberately cannot do
------------------------------
It never emits ``QUALIFIED``. That tier means testwork was done, a contract was
signed, or the operator named this specific feed; all three are pair-specific
evidence that lives on the edge and cannot be recovered from either node. The
richest thing form can support is ``FEED_ENVELOPE``.

Output is therefore a *candidate queue*, not an edge set. Routes come back stamped
MODEL_ESTIMATE / LOW and a curated edge always wins on collision - see
``rank_for_review``. Treating these as assertions would overwrite the handful of
hand-entered rows where a human read the document and concluded the mechanical
answer was wrong, and those rows carry most of the layer's information.
"""

from dataclasses import dataclass

from src.models import (
    FeedSpec,
    HostMineral,
    MaterialCategory,
    ProcessingFacility,
    ProductForm,
    Project,
    Provenance,
    ProvenanceType,
    QualificationTier,
    Confidence,
)

#: Stages at which a stream is still mine product rather than refinery output.
MINE_PRODUCT_STAGES = frozenset(
    {MaterialCategory.ORE, MaterialCategory.CONCENTRATE, MaterialCategory.CARBONATE}
)

#: How far along the chain a stream sits. Only the ordering is meaningful.
_CATEGORY_STAGE = {
    MaterialCategory.ORE: 0,
    MaterialCategory.CONCENTRATE: 1,
    MaterialCategory.CARBONATE: 2,
    MaterialCategory.OXIDE: 3,
    MaterialCategory.METAL: 4,
    MaterialCategory.ALLOY: 5,
    MaterialCategory.MAGNET: 6,
}

#: Hosts that still need a cracking circuit. A stream in one of these has *not*
#: been through the front end that a mineral-concentrate refinery provides.
UNCRACKED_HOSTS = frozenset(
    {
        HostMineral.XENOTIME,
        HostMineral.MONAZITE,
        HostMineral.BASTNAESITE,
        HostMineral.MIXED_PHOSPHATE,
        HostMineral.UNSEPARATED_SANDS,
    }
)


@dataclass(frozen=True)
class RouteCandidate:
    """A mine-to-plant route proposed from form, with the reasoning that produced it."""

    from_id: str
    to_id: str
    material_id: str
    qualification: QualificationTier
    rationale: str

    @property
    def relationship_id(self) -> str:
        """Deterministic id, so regenerating the file is a no-op when nothing moved."""
        return f"rel-auto-{self.from_id.removeprefix('proj-')}-{self.to_id.removeprefix('fac-')}"

    @property
    def provenance(self) -> Provenance:
        """Every inferred route says plainly that a rule wrote it."""
        return Provenance(
            type=ProvenanceType.AUTOMATED,
            unverified_model_extraction=True,
            source_id=None,
            assertion_confidence=Confidence.LOW,
            last_verified=None,
        )


def consumes_mine_product(
    plant: ProcessingFacility, categories: dict[str, MaterialCategory]
) -> bool:
    """Whether a plant declares any feed a mine could actually ship it.

    Keyed off the declared envelope rather than ``FacilityType``, because type
    describes what a site *is*, not what it eats: USAR Wheat Ridge is typed OTHER
    (it is a demonstration facility, not a separation plant) and still takes
    concentrate and MREC, while a magnet plant takes only alloy and oxide and can
    never be a reroute destination for a mine.
    """
    return any(
        categories[a.value.material_id] in MINE_PRODUCT_STAGES for a in plant.accepted_feeds
    )


def _stage(form: ProductForm, categories: dict[str, MaterialCategory]) -> int:
    """Chain position of a shipped form, refined by how far its host has come.

    A leach-derived stream and a flotation concentrate can share a material id and
    sit on opposite sides of a refinery's front end, so the host breaks the tie.
    Bulk mineral sands score *below* a clean concentrate at the same category:
    Fingerboards HMC still needs mineral separation, which puts it upstream of a
    monazite concentrate rather than level with one.
    """
    base = _CATEGORY_STAGE[categories[form.material_id]] * 3
    if form.host_mineral is HostMineral.UNSEPARATED_SANDS:
        return base
    return base + 1 if form.host_mineral in UNCRACKED_HOSTS else base + 2


def _has_stage_beyond(
    products: tuple[ProductForm, ...], stage: int, categories: dict[str, MaterialCategory]
) -> bool:
    """Whether a plant makes anything more processed than an incoming stream.

    Declared feeds say where a flowsheet *starts*; products say where it ends. A
    refinery that cracks concentrate also owns the separation circuit behind it, so
    an MREC arriving there enters mid-flowsheet rather than bouncing off the front
    door. A plant whose only product is MREC has no such stage, and MREC in is then
    genuinely pointless - that is the difference between Caremag and Kalgoorlie.
    """
    return any(_stage(p, categories) > stage for p in products)


def classify(
    form: ProductForm,
    feeds: tuple[FeedSpec, ...],
    categories: dict[str, MaterialCategory],
    plant_products: tuple[ProductForm, ...] = (),
) -> tuple[QualificationTier, str]:
    """Tier one shipped form against a plant's whole declared envelope."""
    if any(f.accepts(form) for f in feeds):
        return (
            QualificationTier.FEED_ENVELOPE,
            f"{form.material_id} in {form.host_mineral.value} host is inside the declared envelope",
        )

    same_id = [f for f in feeds if f.material_id == form.material_id]
    if same_id:
        hosts = sorted({h.value for f in same_id for h in f.accepted_hosts})
        if form.host_mineral is HostMineral.UNDISCLOSED:
            return (
                QualificationTier.PLAUSIBLE,
                f"plant takes {form.material_id} but only in {hosts}; this product's mineral host is not disclosed, so it cannot clear a narrowed envelope",
            )
        if form.host_mineral not in UNCRACKED_HOSTS:
            return (
                QualificationTier.PLAUSIBLE,
                f"plant takes {form.material_id} only in {hosts}; this stream is already cracked, so it would have to enter downstream of the declared front end",
            )
        return (
            QualificationTier.PLAUSIBLE,
            f"plant takes {form.material_id} but only in {hosts}; a {form.host_mineral.value} host would need a different front end",
        )

    # Only mine-product classes bound the comparison: a plant's magnet-recycling or
    # oxide feed says nothing about how far along a mined stream may arrive.
    wanted = [
        _stage(ProductForm(f.material_id, _canonical_host(f, categories)), categories)
        for f in feeds
        if categories[f.material_id] in MINE_PRODUCT_STAGES
    ]
    if not wanted:
        return QualificationTier.INFEASIBLE, "plant declares no feed class a mine could ship it"

    here = _stage(form, categories)
    if here > max(wanted) and not _has_stage_beyond(plant_products, here, categories):
        return (
            QualificationTier.INFEASIBLE,
            "this stream is more processed than every class the plant declares, and the plant makes nothing more processed than it - there is no stage left for it to enter",
        )
    return (
        QualificationTier.PLAUSIBLE,
        "nothing in the declared envelope matches this form, but the plant sits at or beyond this stage - a conversion step could bridge it, and none is publicly established",
    )


def _canonical_host(feed: FeedSpec, categories: dict[str, MaterialCategory]) -> HostMineral:
    """The least-processed host a declared class implies, for stage comparison."""
    if feed.accepted_hosts:
        return min(feed.accepted_hosts, key=lambda h: 0 if h in UNCRACKED_HOSTS else 1)
    return (
        HostMineral.MONAZITE
        if categories[feed.material_id] is MaterialCategory.CONCENTRATE
        else HostMineral.CRACKED
    )


def infer_routes(
    projects: list[Project],
    facilities: list[ProcessingFacility],
    categories: dict[str, MaterialCategory],
) -> list[RouteCandidate]:
    """Propose a tier for every (mine product, feed-consuming plant) pair."""
    out: list[RouteCandidate] = []
    plants = [f for f in facilities if consumes_mine_product(f, categories)]
    for project in projects:
        for plant in plants:
            feeds = tuple(a.value for a in plant.accepted_feeds)
            made = tuple(a.value for a in plant.products)
            best: tuple[QualificationTier, str, str] | None = None
            for attested in project.products:
                tier, why = classify(attested.value, feeds, categories, made)
                rank = _TIER_RANK[tier]
                if best is None or rank > _TIER_RANK[best[0]]:
                    best = (tier, why, attested.value.material_id)
            if best is None:
                continue
            tier, why, material_id = best
            out.append(RouteCandidate(project.id, plant.id, material_id, tier, why))
    return out


#: Best tier wins when a mine ships several forms into the same plant.
_TIER_RANK = {
    QualificationTier.INFEASIBLE: 0,
    QualificationTier.PLAUSIBLE: 1,
    QualificationTier.FEED_ENVELOPE: 2,
    QualificationTier.QUALIFIED: 3,
}

#: Tiers that put a route inside the plant's declared envelope.
INSIDE_ENVELOPE = frozenset({QualificationTier.QUALIFIED, QualificationTier.FEED_ENVELOPE})


def rank_for_review(
    candidates: list[RouteCandidate], curated: set[tuple[str, str]]
) -> list[RouteCandidate]:
    """Drop candidates a human has already ruled on, keep the ones worth reading.

    A curated edge always wins: the point of the pass is to shorten the queue, not
    to restate or overwrite decisions already made.
    """
    return [
        c
        for c in candidates
        if (c.from_id, c.to_id) not in curated and c.qualification in INSIDE_ENVELOPE
    ]
