import type { AlertGraph } from "@/lib/monitor/graphs";
import { nodesById } from "@/lib/monitor/graphs";
import { capacityAssumption } from "@/lib/brief/derive";

/** 0 is the curated layer; 1 is the inferred layer, which calls itself
 *  "not evidence" — the label has to keep saying so. */
function evidenceLabel(evidenceClass: number | undefined): string {
  if (evidenceClass === 0) return "Curated";
  if (evidenceClass === 1) return "Inferred";
  return "—";
}

/**
 * Section 6: the ranked alternatives, in the engine's order. The criterion and
 * weight behind the scores are stated in the section header (the console
 * passes them as the header's aside), so the table carries figures without a
 * legend — and the critical assumption beneath is what keeps a top rank from
 * reading as a replacement in hand.
 */
export default function AlternativesSection({
  graph,
}: {
  readonly graph?: AlertGraph;
}) {
  const lookup = graph ? nodesById(graph) : undefined;

  return (
    <div className="flex flex-col gap-2.5">
      {graph && graph.alternatives.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                {["#", "Source", "Feeds", "Evidence", "Score"].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="border-b border-surface-2 py-2 pr-3 font-mono text-[11px] font-semibold tracking-[0.15em] text-text-tertiary uppercase last:pr-0 last:text-right"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {graph.alternatives.map((alt) => {
                const feeds = lookup?.get(alt.feedsNodeId);
                return (
                  <tr
                    key={alt.id}
                    className="border-b border-surface-2 align-baseline"
                  >
                    <td className="py-2.5 pr-3 font-mono text-base font-semibold text-accent tabular-nums">
                      {alt.rank}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-foreground">
                          {alt.name}
                        </span>
                        <span className="text-xs leading-snug text-text-secondary">
                          {alt.country}
                        </span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs leading-snug text-text-secondary">
                      {feeds?.name ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-[10px] tracking-[0.1em] text-text-tertiary uppercase">
                      {evidenceLabel(alt.evidenceClass)}
                    </td>
                    <td className="py-2.5 text-right">
                      {alt.score != null ? (
                        <span className="flex flex-col items-end gap-1">
                          <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
                            {alt.score.toFixed(0)}
                          </span>
                          <span
                            aria-hidden
                            className="block h-[3px] w-20 bg-surface-2"
                          >
                            <span
                              className="block h-full bg-accent"
                              style={{ width: `${alt.score}%` }}
                            />
                          </span>
                        </span>
                      ) : (
                        <span
                          className="font-mono text-sm text-text-tertiary"
                          title="Seeded order without a score — this graph predates scoring"
                        >
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-text-tertiary">
          No alternatives identified yet.
        </p>
      )}

      {/* The assumption a reader must carry out of this section, so it sits
          inside it rather than in §8 with the general caveats. */}
      <div className="flex flex-col gap-1.5 border border-accent bg-accent-tint px-3.5 py-3">
        <p className="font-mono text-[11px] font-semibold tracking-[0.15em] text-accent uppercase">
          Critical assumption — mining capacity
        </p>
        <p className="max-w-4xl text-[13px] leading-relaxed text-text-secondary">
          {capacityAssumption(graph)}
        </p>
      </div>
    </div>
  );
}
