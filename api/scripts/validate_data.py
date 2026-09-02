"""Load every seed-data file into its dataclass and check cross-references.

Run from ``api/``:  .venv/bin/python scripts/validate_data.py
Exits non-zero if any record fails to construct or any reference dangles.
"""

import json
import sys
from collections import Counter
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.feed_matching import INSIDE_ENVELOPE, infer_routes  # noqa: E402
from src.models import (  # noqa: E402
    Attested,
    Capacity,
    Component,
    Confidence,
    Coordinates,
    Country,
    Deposit,
    DevelopmentStage,
    FacilityType,
    FeedSpec,
    HostMineral,
    Material,
    MaterialCategory,
    OperatingStatus,
    Organization,
    OrganizationType,
    Platform,
    PlatformKind,
    ProcessingFacility,
    ProductForm,
    ProductionFigure,
    ProductionPeriod,
    Project,
    Provenance,
    ProvenanceType,
    QualificationTier,
    Relationship,
    RelationshipStatus,
    RelationshipType,
    ResourceClassification,
    ResourceEstimate,
    Source,
    SourceType,
)

DATA = Path(__file__).resolve().parents[1] / "src" / "data"


def load(name: str) -> list[dict]:
    """Records carrying ``_commented_out`` are skipped - JSON has no comment syntax.

    The key holds the reason the record sits outside the currently loaded subset.
    Deleting that one line puts the record back; nothing else about it is changed.
    """
    return [r for r in json.loads((DATA / f"{name}.json").read_text()) if "_commented_out" not in r]


def parse_date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


def parse_prov(raw: dict) -> Provenance:
    conf = Confidence(raw["assertion_confidence"]) if raw["assertion_confidence"] else None
    return Provenance(
        type=ProvenanceType(raw["type"]),
        unverified_model_extraction=raw.get("unverified_model_extraction", True),
        source_id=raw["source_id"],
        assertion_confidence=conf,
        last_verified=parse_date(raw["last_verified"]),
    )


def attested(raw: dict | None, cast=lambda v: v) -> Attested | None:
    return None if raw is None else Attested(cast(raw["value"]), parse_prov(raw["provenance"]))


def estimate(raw: dict) -> ResourceEstimate:
    return ResourceEstimate(**{**raw, "classification": ResourceClassification(raw["classification"]), "provenance": parse_prov(raw["provenance"])})


def relationship(raw: dict) -> Relationship:
    return Relationship(**{**raw, "type": RelationshipType(raw["type"]), "status": RelationshipStatus(raw["status"]), "provenance": parse_prov(raw["provenance"]), "material_ids": tuple(raw["material_ids"]), "qualification": QualificationTier(raw["qualification"]) if raw.get("qualification") else None})


def figure(raw: dict) -> ProductionFigure:
    return ProductionFigure(**{**raw, "period": ProductionPeriod(raw["period"])})


def product(raw: dict) -> ProductForm:
    return ProductForm(**{**raw, "host_mineral": HostMineral(raw["host_mineral"])})


def feed(raw: dict) -> FeedSpec:
    return FeedSpec(**{**raw, "accepted_hosts": tuple(HostMineral(h) for h in raw["accepted_hosts"])})


def build() -> dict[str, list]:
    return {
        "sources": [Source(**{**r, "source_type": SourceType(r["source_type"]), "published_on": parse_date(r["published_on"]), "source_confidence": Confidence(r["source_confidence"]) if r["source_confidence"] else None}) for r in load("sources")],
        "countries": [Country(**{**r, "alignment": attested(r["alignment"]), "risk_score": attested(r["risk_score"])}) for r in load("countries")],
        "deposits": [Deposit(**{**r, "commodities": tuple(r["commodities"]), "aliases": tuple(r["aliases"]), "coordinates": attested(r["coordinates"], lambda v: Coordinates(**v)), "resource_estimates": tuple(estimate(e) for e in r["resource_estimates"])}) for r in load("deposits")],
        "organizations": [Organization(**{**r, "organization_type": OrganizationType(r["organization_type"]), "government_affiliation": attested(r["government_affiliation"]), "aliases": tuple(r["aliases"])}) for r in load("organizations")],
        "projects": [Project(**{**r, "development_stage": attested(r["development_stage"], DevelopmentStage), "operating_status": attested(r["operating_status"], OperatingStatus), "expected_production_start": attested(r["expected_production_start"]), "planned_production": tuple(attested(f, figure) for f in r["planned_production"]), "products": tuple(attested(x, product) for x in r["products"]), "resource_estimates": tuple(estimate(e) for e in r["resource_estimates"]), "aliases": tuple(r["aliases"])}) for r in load("projects")],
        "facilities": [ProcessingFacility(**{**r, "facility_type": FacilityType(r["facility_type"]), "operating_status": attested(r["operating_status"], OperatingStatus), "coordinates": attested(r["coordinates"], lambda v: Coordinates(**v)), "expected_start": attested(r["expected_start"]), "accepted_feeds": tuple(attested(x, feed) for x in r["accepted_feeds"]), "products": tuple(attested(x, product) for x in r["products"]), "capacities": tuple(attested(c, lambda v: Capacity(**v)) for c in r["capacities"]), "aliases": tuple(r["aliases"])}) for r in load("facilities")],
        "materials": [Material(**{**r, "category": MaterialCategory(r["category"]), "elements": tuple(r["elements"])}) for r in load("materials")],
        "components": [Component(**{**r, "requires": tuple(attested(a) for a in r["requires"])}) for r in load("components")],
        "platforms": [Platform(**{**r, "kind": PlatformKind(r["kind"]), "requires": tuple(attested(a) for a in r["requires"])}) for r in load("platforms")],
        "relationships": [relationship(r) for r in load("relationships")],
        "relationships_inferred": [relationship(r) for r in load("relationships_inferred")],
    }


def check(data: dict[str, list]) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    ids = {k: {x.id for x in v} for k, v in data.items()}
    edge_keys = ("relationships", "relationships_inferred")
    node_ids = set().union(*(ids[k] for k in data if k not in ("sources", *edge_keys)))
    used_sources: set[str] = set()

    all_ids = [x.id for v in data.values() for x in v]
    errors += [f"duplicate id {i}" for i, n in Counter(all_ids).items() if n > 1]

    def cite(owner: str, item) -> None:
        prov = getattr(item, "provenance", None)
        if prov and prov.source_id:
            used_sources.add(prov.source_id)
            if prov.source_id not in ids["sources"]:
                errors.append(f"{owner}: unknown source {prov.source_id}")

    for d in data["deposits"]:
        if d.country_id not in ids["countries"]:
            errors.append(f"{d.id}: unknown country {d.country_id}")
        for a in (d.coordinates, *d.resource_estimates):
            cite(d.id, a)
    for o in data["organizations"]:
        cite(o.id, o.government_affiliation)
        if o.headquarters_country_id and o.headquarters_country_id not in ids["countries"]:
            errors.append(f"{o.id}: unknown country {o.headquarters_country_id}")
        if o.parent_organization_id and o.parent_organization_id not in ids["organizations"]:
            errors.append(f"{o.id}: unknown parent {o.parent_organization_id}")
    for p in data["projects"]:
        if p.country_id not in ids["countries"]:
            errors.append(f"{p.id}: unknown country {p.country_id}")
        if p.deposit_id and p.deposit_id not in ids["deposits"]:
            errors.append(f"{p.id}: unknown deposit {p.deposit_id}")
        if p.operator_id and p.operator_id not in ids["organizations"]:
            errors.append(f"{p.id}: unknown operator {p.operator_id}")
        for a in (p.development_stage, p.operating_status, p.expected_production_start, *p.planned_production, *p.products, *p.resource_estimates):
            cite(p.id, a)
        errors += [f"{p.id}: unknown material {f.value.material_id}" for f in (*p.planned_production, *p.products) if f.value.material_id not in ids["materials"]]
    for f in data["facilities"]:
        if f.country_id not in ids["countries"]:
            errors.append(f"{f.id}: unknown country {f.country_id}")
        if f.operator_id and f.operator_id not in ids["organizations"]:
            errors.append(f"{f.id}: unknown operator {f.operator_id}")
        for a in (f.operating_status, f.expected_start, f.coordinates, *f.capacities, *f.accepted_feeds, *f.products):
            cite(f.id, a)
        mats = f.input_material_ids + f.output_material_ids + tuple(c.value.material_id for c in f.capacities)
        errors += [f"{f.id}: unknown material {m}" for m in mats if m not in ids["materials"]]
    for c in data["components"]:
        for a in c.requires:
            cite(c.id, a)
            if a.value not in ids["materials"]:
                errors.append(f"{c.id}: unknown material {a.value}")
    for p in data["platforms"]:
        for a in p.requires:
            cite(p.id, a)
            if a.value not in ids["components"]:
                errors.append(f"{p.id}: unknown component {a.value}")
        if p.parent_id and p.parent_id not in ids["platforms"]:
            errors.append(f"{p.id}: unknown parent platform {p.parent_id}")
    for r in (*data["relationships"], *data["relationships_inferred"]):
        cite(r.id, r)
        if r.from_id not in node_ids:
            errors.append(f"{r.id}: unknown from_id {r.from_id}")
        if r.to_id and r.to_id not in node_ids:
            errors.append(f"{r.id}: unknown to_id {r.to_id}")
        errors += [f"{r.id}: unknown material {m}" for m in r.material_ids if m not in ids["materials"]]

    errors += [
        f"{r.id}: AUTOMATED provenance does not belong in relationships.json"
        for r in data["relationships"]
        if r.provenance.type is ProvenanceType.AUTOMATED
    ]
    errors += [
        f"{r.id}: relationships_inferred.json must be AUTOMATED, got {r.provenance.type.value}"
        for r in data["relationships_inferred"]
        if r.provenance.type is not ProvenanceType.AUTOMATED
    ]
    curated_pairs = {(r.from_id, r.to_id) for r in data["relationships"]}
    errors += [
        f"{r.id}: derived edge shadows a curated edge for the same pair - the curated call wins, regenerate"
        for r in data["relationships_inferred"]
        if (r.from_id, r.to_id) in curated_pairs
    ]

    warnings = [f"unused source {s}" for s in sorted(ids["sources"] - used_sources)]
    warnings += [f"unanchored source {s.id} (no url)" for s in data["sources"] if s.url is None]
    flows = {(r.from_id, r.to_id) for r in data["relationships"] if r.type is RelationshipType.SUPPLIES}
    warnings += [
        f"{r.id}: CAN_SUPPLY duplicates an existing SUPPLIES edge - put the tier on that edge instead"
        for r in data["relationships"]
        if r.type is RelationshipType.CAN_SUPPLY and (r.from_id, r.to_id) in flows
    ]
    supplies_from = {r.from_id for r in data["relationships"] if r.type is RelationshipType.SUPPLIES}
    warnings += [f"{p.id} has no SUPPLIES edge" for p in data["projects"] if p.id not in supplies_from]
    warnings += [f"{p.id} has no product form" for p in data["projects"] if not p.products]
    warnings += _form_disagreements(data)
    return errors, warnings


def _form_disagreements(data: dict[str, list]) -> list[str]:
    """Flag edges whose tier contradicts what the two nodes' declared forms imply.

    Not an error: ``accepted_feeds`` is a coarse class descriptor and the edge is
    a judgment about a specific pair, so they are allowed to disagree. Each hit is
    either a documented envelope boundary worth a note, or a tier that drifted -
    both worth a human look, neither safe to auto-correct.
    """
    categories = {m.id: m.category for m in data["materials"]}
    projects = {p.id: p for p in data["projects"]}
    facilities = {f.id: f for f in data["facilities"]}
    inferred = {
        (c.from_id, c.to_id): c
        for c in infer_routes(list(projects.values()), list(facilities.values()), categories)
    }
    out = []
    for r in data["relationships"]:
        if r.qualification is None or r.from_id not in projects or r.to_id not in facilities:
            continue
        cand = inferred.get((r.from_id, r.to_id))
        if cand is None:
            continue
        if (r.qualification in INSIDE_ENVELOPE) != (cand.qualification in INSIDE_ENVELOPE):
            out.append(
                f"{r.id}: tier {r.qualification.value} disagrees with declared forms "
                f"(implies {cand.qualification.value}) - {cand.rationale}"
            )
    return out


def main() -> int:
    try:
        data = build()
    except (ValueError, TypeError, KeyError) as exc:
        print(f"FAILED to construct records: {exc}")
        return 1
    errors, warnings = check(data)
    print("records:", ", ".join(f"{len(v)} {k}" for k, v in data.items()))
    for w in warnings:
        print("warning:", w)
    for e in errors:
        print("ERROR:", e)
    print("OK" if not errors else f"{len(errors)} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
