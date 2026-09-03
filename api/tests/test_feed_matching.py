"""The tiering rules that matter, pinned against real rows from the seed data."""

from src.feed_matching import classify, consumes_mine_product, infer_routes
from src.models import (
    Attested,
    FacilityType,
    FeedSpec,
    HostMineral,
    MaterialCategory,
    OperatingStatus,
    ProcessingFacility,
    ProductForm,
    Provenance,
    ProvenanceType,
    QualificationTier,
)

CATEGORIES = {
    "mat-re-concentrate": MaterialCategory.CONCENTRATE,
    "mat-hre-concentrate": MaterialCategory.CONCENTRATE,
    "mat-monazite-concentrate": MaterialCategory.CONCENTRATE,
    "mat-heavy-mineral-concentrate": MaterialCategory.CONCENTRATE,
    "mat-mrec": MaterialCategory.CARBONATE,
    "mat-dy-oxide": MaterialCategory.OXIDE,
    "mat-ndfeb-alloy": MaterialCategory.ALLOY,
}
PROV = Provenance(type=ProvenanceType.INFERRED, assertion_confidence=None)
MINERAL = (HostMineral.XENOTIME, HostMineral.MONAZITE, HostMineral.MIXED_PHOSPHATE)


def attested(value):
    return Attested(value, PROV)


def facility(fid, feeds, ftype=FacilityType.REFINERY):
    return ProcessingFacility(
        id=fid,
        name=fid,
        facility_type=ftype,
        country_id="AU",
        operating_status=attested(OperatingStatus.OPERATING),
        accepted_feeds=tuple(attested(f) for f in feeds),
    )


def test_declared_class_and_host_gives_feed_envelope() -> None:
    """Browns Range xenotime into Eneabba: the plain inside-the-envelope case."""
    form = ProductForm("mat-hre-concentrate", HostMineral.XENOTIME)
    feeds = (FeedSpec("mat-hre-concentrate", (HostMineral.XENOTIME,)),)
    tier, _ = classify(form, feeds, CATEGORIES)
    assert tier is QualificationTier.FEED_ENVELOPE


def test_cracked_stream_into_a_mineral_front_end_is_plausible_not_infeasible() -> None:
    """Round Top's leach-derived stream into a plant that wants mineral concentrate.

    Form cannot separate the curated INFEASIBLE (Round Top -> Eneabba) from the
    curated PLAUSIBLE (Round Top -> Caremag): they are form-identical, and the
    tiers differ only on evidence the nodes do not carry. The pass fails safe -
    surfacing a route for review costs a read, pruning a real one is silent.
    """
    form = ProductForm("mat-re-concentrate", HostMineral.CRACKED)
    feeds = (FeedSpec("mat-re-concentrate", MINERAL),)
    tier, why = classify(form, feeds, CATEGORIES)
    assert tier is QualificationTier.PLAUSIBLE
    assert "downstream of the declared front end" in why


def test_carbonate_into_a_front_end_only_plant_is_infeasible() -> None:
    """MREC into Lynas Kalgoorlie: it cracks concentrate and its product IS MREC.

    This is what INFEASIBLE is reserved for - nothing the plant makes sits beyond
    the incoming stream, so there is no stage for it to enter at.
    """
    form = ProductForm("mat-mrec", HostMineral.CRACKED)
    feeds = (FeedSpec("mat-re-concentrate", MINERAL),)
    makes = (ProductForm("mat-mrec", HostMineral.CRACKED),)
    tier, why = classify(form, feeds, CATEGORIES, makes)
    assert tier is QualificationTier.INFEASIBLE
    assert "no stage left for it to enter" in why


def test_same_stream_is_plausible_at_a_plant_with_a_separation_back_end() -> None:
    """MREC into Caremag: declared feed is mining concentrate, but it makes oxide.

    Declared feeds say where a flowsheet starts, not where it ends. Reading only
    the feed list hard-pruned all four curated MREC-to-Caremag routes.
    """
    form = ProductForm("mat-mrec", HostMineral.CRACKED)
    feeds = (FeedSpec("mat-hre-concentrate", MINERAL),)
    makes = (ProductForm("mat-dy-oxide", HostMineral.CRACKED),)
    assert classify(form, feeds, CATEGORIES, makes)[0] is QualificationTier.PLAUSIBLE


def test_bulk_sands_rank_below_a_clean_concentrate() -> None:
    """Fingerboards HMC into a beneficiation plant: upstream, so never INFEASIBLE.

    HMC still needs mineral separation. Ranking it level with a monazite
    concentrate made the pass prune the one route that most obviously wants review.
    """
    form = ProductForm("mat-heavy-mineral-concentrate", HostMineral.UNSEPARATED_SANDS)
    feeds = (FeedSpec("mat-monazite-concentrate", (HostMineral.MONAZITE,)),)
    assert classify(form, feeds, CATEGORIES)[0] is QualificationTier.PLAUSIBLE


def test_a_magnet_feed_does_not_licence_a_more_processed_mine_stream() -> None:
    """Only mine-product classes bound the stage comparison."""
    form = ProductForm("mat-mrec", HostMineral.CRACKED)
    feeds = (
        FeedSpec("mat-re-concentrate", MINERAL),
        FeedSpec("mat-ndfeb-alloy", (HostMineral.CRACKED,)),
    )
    makes = (ProductForm("mat-mrec", HostMineral.CRACKED),)
    assert classify(form, feeds, CATEGORIES, makes)[0] is QualificationTier.INFEASIBLE


def test_uncracked_concentrate_into_an_mrec_plant_is_plausible_not_infeasible() -> None:
    """Browns Range -> Ucore: needs a cracking step that could exist but does not."""
    form = ProductForm("mat-hre-concentrate", HostMineral.XENOTIME)
    feeds = (FeedSpec("mat-mrec", (HostMineral.CRACKED,)),)
    tier, _ = classify(form, feeds, CATEGORIES)
    assert tier is QualificationTier.PLAUSIBLE


def test_undisclosed_host_cannot_clear_a_narrowed_envelope() -> None:
    """Fail closed: an unknown host must never be treated as a wildcard."""
    form = ProductForm("mat-hre-concentrate", HostMineral.UNDISCLOSED)
    narrowed = (FeedSpec("mat-hre-concentrate", (HostMineral.XENOTIME,)),)
    assert classify(form, narrowed, CATEGORIES)[0] is QualificationTier.PLAUSIBLE
    unconstrained = (FeedSpec("mat-hre-concentrate", ()),)
    assert classify(form, unconstrained, CATEGORIES)[0] is QualificationTier.FEED_ENVELOPE


def test_bastnaesite_does_not_clear_a_phosphate_envelope() -> None:
    """The mat-re-concentrate conflation: one id, incompatible front ends."""
    form = ProductForm("mat-re-concentrate", HostMineral.BASTNAESITE)
    feeds = (FeedSpec("mat-re-concentrate", (HostMineral.MIXED_PHOSPHATE, HostMineral.MONAZITE)),)
    assert classify(form, feeds, CATEGORIES)[0] is QualificationTier.PLAUSIBLE


def test_plant_filter_follows_the_envelope_not_the_facility_type() -> None:
    """Wheat Ridge is typed OTHER and still eats concentrate; a magnet plant does not."""
    demo = facility("fac-demo", [FeedSpec("mat-mrec", (HostMineral.CRACKED,))], FacilityType.OTHER)
    magnets = facility(
        "fac-magnets",
        [FeedSpec("mat-ndfeb-alloy", (HostMineral.CRACKED,))],
        FacilityType.MAGNET_MANUFACTURING,
    )
    assert consumes_mine_product(demo, CATEGORIES)
    assert not consumes_mine_product(magnets, CATEGORIES)


def test_inference_never_emits_qualified() -> None:
    """QUALIFIED needs pair-specific evidence and must stay unreachable from form."""
    from src.models import DevelopmentStage, Project

    mine = Project(
        id="proj-x",
        name="x",
        country_id="AU",
        development_stage=attested(DevelopmentStage.PRODUCTION),
        operating_status=attested(OperatingStatus.OPERATING),
        products=(attested(ProductForm("mat-mrec", HostMineral.CRACKED)),),
    )
    plant = facility("fac-y", [FeedSpec("mat-mrec", (HostMineral.CRACKED,))])
    tiers = {c.qualification for c in infer_routes([mine], [plant], CATEGORIES)}
    assert QualificationTier.QUALIFIED not in tiers
    assert tiers == {QualificationTier.FEED_ENVELOPE}
