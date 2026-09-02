"""Load every seed-data file and check cross-references.

Run from ``api/``:  .venv/bin/python scripts/validate_data.py
Exits non-zero if any record fails to construct or any reference dangles.
Parsing lives in ``src.data_loader``; this script owns only the checks.
"""

import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.data_loader import DataLoadError, load_all  # noqa: E402
from src.models import RelationshipType  # noqa: E402

DATA = Path(__file__).resolve().parents[1] / "src" / "data"


def check(data: dict[str, tuple]) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    ids = {k: {x.id for x in v} for k, v in data.items()}
    node_ids = set().union(*(ids[k] for k in data if k not in ("sources", "relationships")))
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
        for a in (
            p.development_stage,
            p.operating_status,
            p.expected_production_start,
            *p.planned_production,
            *p.resource_estimates,
        ):
            cite(p.id, a)
        errors += [
            f"{p.id}: unknown material {f.value.material_id}"
            for f in p.planned_production
            if f.value.material_id not in ids["materials"]
        ]
    for f in data["facilities"]:
        if f.country_id not in ids["countries"]:
            errors.append(f"{f.id}: unknown country {f.country_id}")
        if f.operator_id and f.operator_id not in ids["organizations"]:
            errors.append(f"{f.id}: unknown operator {f.operator_id}")
        for a in (f.operating_status, f.expected_start, f.coordinates, *f.capacities):
            cite(f.id, a)
        mats = f.input_material_ids + f.output_material_ids + tuple(c.value.material_id for c in f.capacities)
        errors += [f"{f.id}: unknown material {m}" for m in mats if m not in ids["materials"]]
    for c in data["components"]:
        for a in c.requires:
            cite(c.id, a)
            if a.value not in ids["materials"]:
                errors.append(f"{c.id}: unknown material {a.value}")
    for s in data["systems"]:
        for a in s.requires:
            cite(s.id, a)
            if a.value not in ids["components"]:
                errors.append(f"{s.id}: unknown component {a.value}")
    for r in data["relationships"]:
        cite(r.id, r)
        if r.from_id not in node_ids:
            errors.append(f"{r.id}: unknown from_id {r.from_id}")
        if r.to_id and r.to_id not in node_ids:
            errors.append(f"{r.id}: unknown to_id {r.to_id}")
        errors += [f"{r.id}: unknown material {m}" for m in r.material_ids if m not in ids["materials"]]

    warnings = [f"unused source {s}" for s in sorted(ids["sources"] - used_sources)]
    warnings += [f"unanchored source {s.id} (no url)" for s in data["sources"] if s.url is None]
    supplies_from = {r.from_id for r in data["relationships"] if r.type is RelationshipType.SUPPLIES}
    warnings += [f"{p.id} has no SUPPLIES edge" for p in data["projects"] if p.id not in supplies_from]
    return errors, warnings


def main() -> int:
    try:
        data = load_all(DATA)
    except DataLoadError as exc:
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
