"""Score the form-based route inference against the curated CAN_SUPPLY layer.

Run from ``api/``:  python3 scripts/verify_feed_matching.py

Reports two numbers that are easy to confuse and must not be:

* **Tier agreement** - on the cells a human has already ruled on, does form put the
  route on the same side of the envelope? This is the ~94% figure.
* **Queue precision** - of the cells nobody has ruled on, how many does the pass
  propose? These have no ground truth at all. The pass is a candidate generator,
  and this number is the review burden, not an accuracy.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.validate_data import build  # noqa: E402
from src.feed_matching import (  # noqa: E402
    INSIDE_ENVELOPE,
    consumes_mine_product,
    infer_routes,
    rank_for_review,
)
from src.models import QualificationTier, RelationshipType  # noqa: E402

MINE_EDGE_TYPES = (RelationshipType.SUPPLIES, RelationshipType.CAN_SUPPLY)


def main() -> int:
    data = build()
    categories = {m.id: m.category for m in data["materials"]}
    projects = {p.id: p for p in data["projects"]}
    facilities = {f.id: f for f in data["facilities"]}

    curated = {
        (r.from_id, r.to_id): r
        for r in data["relationships"]
        if r.type in MINE_EDGE_TYPES
        and r.from_id in projects
        and r.to_id in facilities
        and r.qualification is not None
    }
    candidates = infer_routes(list(projects.values()), list(facilities.values()), categories)
    by_pair = {(c.from_id, c.to_id): c for c in candidates}

    plants = [f for f in facilities.values() if consumes_mine_product(f, categories)]
    print(f"matrix: {len(projects)} mines x {len(plants)} feed-consuming plants = {len(projects) * len(plants)} cells")
    print(f"curated cells with a tier: {len(curated)}")

    agree, disagree = 0, []
    for pair, edge in curated.items():
        cand = by_pair.get(pair)
        if cand is None:
            disagree.append((pair, edge.qualification, None))
            continue
        if (edge.qualification in INSIDE_ENVELOPE) == (cand.qualification in INSIDE_ENVELOPE):
            agree += 1
        else:
            disagree.append((pair, edge.qualification, cand))

    total = len(curated)
    print(f"\n--- TIER AGREEMENT (inside vs outside the declared envelope) ---")
    print(f"  {agree}/{total} = {agree / total:.1%}")
    print(f"\n  {len(disagree)} disagreement(s) - each is a place a human overrode the mechanical read:")
    for pair, curated_tier, cand in disagree:
        got = cand.qualification.value if cand else "no candidate"
        print(f"    {pair[0]} -> {pair[1]}")
        print(f"        curated={curated_tier.value}  inferred={got}")
        if cand:
            print(f"        why: {cand.rationale}")

    print(f"\n--- EXACT TIER RECOVERY (all four tiers, not just the split) ---")
    exact = sum(
        1
        for pair, edge in curated.items()
        if (c := by_pair.get(pair)) and c.qualification is edge.qualification
    )
    print(f"  {exact}/{total} = {exact / total:.1%}")
    print("  QUALIFIED is unreachable by design - it needs pair-specific evidence:")
    n_qual = sum(1 for e in curated.values() if e.qualification is QualificationTier.QUALIFIED)
    reachable = total - n_qual
    exact_r = sum(
        1
        for pair, edge in curated.items()
        if edge.qualification is not QualificationTier.QUALIFIED
        and (c := by_pair.get(pair))
        and c.qualification is edge.qualification
    )
    print(f"  excluding the {n_qual} QUALIFIED edges: {exact_r}/{reachable} = {exact_r / reachable:.1%}")

    queue = rank_for_review(candidates, set(curated))
    print(f"\n--- REVIEW QUEUE (cells with no curated edge) ---")
    uncurated = len(projects) * len(plants) - len(curated)
    print(f"  {uncurated} uncurated cells; pass proposes {len(queue)} for review ({len(queue) / uncurated:.0%})")
    print("  NO ground truth exists for these. This is a review burden, not an accuracy.")
    for c in sorted(queue, key=lambda c: (c.from_id, c.to_id)):
        print(f"    {c.from_id:<24} -> {c.to_id:<28} {c.qualification.value:<14} [{c.material_id}]")

    ruled_out = [c for c in candidates if (c.from_id, c.to_id) not in curated and c.qualification not in INSIDE_ENVELOPE]
    print(f"\n  pruned without review: {len(ruled_out)} cells scored PLAUSIBLE or INFEASIBLE on form")
    return 0


if __name__ == "__main__":
    sys.exit(main())
