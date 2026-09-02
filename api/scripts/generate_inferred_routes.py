"""Materialise the form-based route pass as AUTOMATED CAN_SUPPLY edges.

Run from ``api/``:  python3 scripts/generate_inferred_routes.py

Writes ``src/data/relationships_inferred.json``. That file is **derived output**:
regenerate it, never hand-edit it. To change a row, change the rule in
``src/feed_matching.py`` or the node data the rule reads.

It is a separate file from ``relationships.json`` on purpose. Curated edges carry
evidence about a specific pair; these carry only the observation that two declared
forms line up. Keeping them apart means a consumer opts in, the curated layer stays
diffable, and no regeneration can ever clobber a hand-written row. Any pair that
already has a curated edge is skipped outright - the curated call always wins.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.validate_data import build  # noqa: E402
from src.feed_matching import consumes_mine_product, infer_routes  # noqa: E402
from src.models import RelationshipStatus, RelationshipType  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "src" / "data" / "relationships_inferred.json"


def house_json(value, indent: int = 0) -> str:
    """Match the seed files: indent 2, but arrays of scalars stay on one line."""
    pad, pad2 = " " * indent, " " * (indent + 2)
    if isinstance(value, dict):
        if not value:
            return "{}"
        body = ",\n".join(
            f"{pad2}{json.dumps(k)}: {house_json(v, indent + 2)}" for k, v in value.items()
        )
        return "{\n" + body + f"\n{pad}}}"
    if isinstance(value, list):
        if not value:
            return "[]"
        if all(not isinstance(x, (dict, list)) for x in value):
            return "[" + ", ".join(json.dumps(x, ensure_ascii=False) for x in value) + "]"
        body = ",\n".join(f"{pad2}{house_json(x, indent + 2)}" for x in value)
        return "[\n" + body + f"\n{pad}]"
    return json.dumps(value, ensure_ascii=False)


def main() -> int:
    data = build()
    categories = {m.id: m.category for m in data["materials"]}
    projects = {p.id: p for p in data["projects"]}
    facilities = {f.id: f for f in data["facilities"]}

    curated = {
        (r.from_id, r.to_id)
        for r in data["relationships"]
        if r.type in (RelationshipType.SUPPLIES, RelationshipType.CAN_SUPPLY)
        and r.from_id in projects
        and r.to_id in facilities
    }
    candidates = [
        c
        for c in infer_routes(list(projects.values()), list(facilities.values()), categories)
        if (c.from_id, c.to_id) not in curated
    ]
    candidates.sort(key=lambda c: (c.from_id, c.to_id))

    rows = []
    for c in candidates:
        prov = c.provenance
        rows.append(
            {
                "id": c.relationship_id,
                "type": RelationshipType.CAN_SUPPLY.value,
                "from_id": c.from_id,
                "to_id": c.to_id,
                "status": RelationshipStatus.POTENTIAL.value,
                "material_ids": [c.material_id],
                "qualification": c.qualification.value,
                "qualification_lead_months": None,
                "annual_tonnes": None,
                "total_tonnes": None,
                "start_year": None,
                "end_year": None,
                "note": f"AUTOMATED, not evidence: {c.rationale}. Regenerate with "
                f"scripts/generate_inferred_routes.py; do not hand-edit.",
                "provenance": {
                    "type": prov.type.value,
                    "unverified_model_extraction": prov.unverified_model_extraction,
                    "source_id": prov.source_id,
                    "assertion_confidence": prov.assertion_confidence.value,
                    "last_verified": None,
                },
            }
        )

    OUT.write_text(house_json(rows) + "\n")

    plants = [f for f in facilities.values() if consumes_mine_product(f, categories)]
    tiers: dict[str, int] = {}
    for r in rows:
        tiers[r["qualification"]] = tiers.get(r["qualification"], 0) + 1
    print(f"wrote {len(rows)} AUTOMATED edges to {OUT.relative_to(Path.cwd())}")
    print(f"  matrix {len(projects)} mines x {len(plants)} plants = {len(projects) * len(plants)} cells")
    print(f"  skipped {len(curated)} cells that already carry a curated edge")
    for tier, n in sorted(tiers.items()):
        print(f"  {tier:<14} {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
