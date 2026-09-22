import type { AlertGraph } from "@/lib/monitor/graphs";
import { nodesById } from "@/lib/monitor/graphs";
import { weightsPhrase } from "@/lib/monitor/brief";
import { RANK_FACTORS, factorName } from "@/lib/monitor/factors";
import {
  DEFAULT_FACTOR_WEIGHTS,
  type FactorWeights,
} from "@/lib/monitor/ranking";
import {
  BRIEF_TABLE,
  BRIEF_TD,
  BRIEF_TD_NAME,
  BRIEF_TH,
  BriefNotice,
} from "./BriefSection";

/**
 * Section 5: replacement sources, ranked as the reader ranked them.
 *
 * The weights are stated before the table because they are an editorial input,
 * not a finding: the same candidates under other weights give another order,
 * and a reader handed only the order cannot tell.
 */
export default function BriefAlternatives({
  graph,
  weights,
  emptyReason,
}: {
  readonly graph?: AlertGraph;
  readonly weights: FactorWeights | null;
  readonly emptyReason: string;
}) {
  if (!graph) return <BriefNotice>{emptyReason}</BriefNotice>;
  if (graph.alternatives.length === 0) {
    return <BriefNotice>No alternative source is identified in the graph.</BriefNotice>;
  }

  const scored = graph.candidates !== undefined;
  const inPlay = weights ?? DEFAULT_FACTOR_WEIGHTS;
  const factors = scored
    ? RANK_FACTORS.filter((factor) => (inPlay[factor] ?? 0) > 0)
    : [];
  const lookup = nodesById(graph);
  const pool = new Set(graph.candidates?.map((c) => c.id)).size;

  return (
    <>
      {scored && (
        <p className="text-xs leading-relaxed text-foreground">
          {weights ? (
            <>
              Ranked on weights set by the reader:{" "}
              <span className="text-accent">{weightsPhrase(weights)}</span>.
            </>
          ) : (
            <>
              No ranking was set, so this is the default order:{" "}
              <span className="text-accent">country alignment alone</span>.
            </>
          )}{" "}
          <span className="text-text-secondary">
            The top {graph.alternatives.length} of {pool} candidates. Weights
            are a judgement about what matters; other weights give another
            order.
          </span>
        </p>
      )}
      <table className={BRIEF_TABLE}>
        <thead>
          <tr>
            <th className={`${BRIEF_TH} w-6`}>#</th>
            <th className={BRIEF_TH}>Source</th>
            <th className={BRIEF_TH}>Would feed</th>
            {factors.map((factor) => (
              <th key={factor} className={BRIEF_TH}>
                {factorName(factor)}
              </th>
            ))}
            {scored && <th className={`${BRIEF_TH} text-right`}>Score</th>}
          </tr>
        </thead>
        <tbody>
          {graph.alternatives.map((alt) => (
            <tr key={alt.id}>
              <td className={`${BRIEF_TD} font-mono font-semibold text-accent tabular-nums`}>
                {alt.rank}
              </td>
              <td className={BRIEF_TD_NAME}>
                {alt.name}
                <span className="block text-[10px] font-normal text-text-tertiary">
                  {alt.country}
                </span>
              </td>
              <td className={BRIEF_TD}>
                {lookup.get(alt.feedsNodeId)?.name ?? "—"}
              </td>
              {factors.map((factor) => {
                const value = alt.scoreFactors?.find((f) => f.factor === factor);
                return (
                  <td
                    key={factor}
                    className={`${BRIEF_TD} font-mono text-[10px] tracking-[0.05em] uppercase`}
                    title={value?.detail ?? undefined}
                  >
                    {value ? value.label.replace(/_/g, " ") : "—"}
                    {/* A fallback value, never to be read as a disclosure. */}
                    {value && !value.known && " ?"}
                  </td>
                );
              })}
              {scored && (
                <td className={`${BRIEF_TD} text-right font-mono font-semibold text-foreground tabular-nums`}>
                  {alt.score?.toFixed(0) ?? "—"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {scored && (
        <p className="text-[10.5px] leading-relaxed text-text-tertiary">
          Score is 0 to 100 under the weights above. Equal scores keep the
          engine&rsquo;s own order. &ldquo;?&rdquo; marks a value the graph does
          not hold, scored on a stated fallback.
        </p>
      )}
    </>
  );
}
