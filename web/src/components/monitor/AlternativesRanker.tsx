import { useState } from "react";

import type { AlertGraph } from "@/lib/monitor/graphs";
import { nodesById } from "@/lib/monitor/graphs";
import { factorDescription, factorName, factorShade } from "@/lib/monitor/factors";
import {
  DEFAULT_FACTOR_WEIGHTS,
  MAX_FACTOR_WEIGHT,
  factorAvailability,
  type FactorAvailability,
  type FactorWeights,
} from "@/lib/monitor/ranking";
import RankedList from "./RankedList";

interface AlternativesRankerProps {
  readonly graph?: AlertGraph;
  /** The weights `graph.alternatives` was ranked under, or null before the
   *  reader has ranked anything. Owned above, because the globe draws the same
   *  ranking and the two must not disagree. */
  readonly appliedWeights: FactorWeights | null;
  readonly onRank: (weights: FactorWeights) => void;
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (id: string) => void;
  /** Why there is no graph, where a fetch is pending or failed. */
  readonly emptyReason: string | null;
}

const WEIGHT_STEPS = Array.from({ length: MAX_FACTOR_WEIGHT }, (_, i) => i + 1);

/** Factors carrying weight, in list order: what a ranking was struck on. */
function weighted(
  weights: FactorWeights,
  factors: readonly FactorAvailability[],
): readonly FactorAvailability[] {
  return factors.filter((f) => (weights[f.factor] ?? 0) > 0);
}

function sameWeights(
  a: FactorWeights,
  b: FactorWeights,
  factors: readonly FactorAvailability[],
): boolean {
  return factors.every((f) => (a[f.factor] ?? 0) === (b[f.factor] ?? 0));
}

/** One factor: a 0-to-max weight, or the reason it cannot carry one. */
function FactorRow({
  availability,
  weight,
  onChange,
}: {
  readonly availability: FactorAvailability;
  readonly weight: number;
  readonly onChange: (weight: number) => void;
}) {
  const { factor, available, missing, total } = availability;
  const name = factorName(factor);

  if (!available) {
    return (
      <li
        className="grid grid-cols-[1fr_auto] items-center gap-2 border-t border-surface-2 px-1 py-1.5 opacity-50"
        title={`${missing} of ${total} candidates have no data for this factor, so ranking on it would rank on a guess.`}
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-[10.5px] text-text-tertiary">{name}</span>
          <span className="text-[9.5px] leading-snug text-text-tertiary">
            {factorDescription(factor)}
          </span>
        </span>
        <span className="font-mono text-[9px] tracking-[0.1em] text-text-tertiary uppercase">
          Data incomplete · {missing}/{total}
        </span>
      </li>
    );
  }

  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-2 border-t border-surface-2 px-1 py-1.5">
      <span className="flex flex-col gap-0.5">
        <span
          className={`text-[10.5px] ${weight > 0 ? "text-foreground" : "text-text-secondary"}`}
        >
          {name}
        </span>
        <span className="text-[9.5px] leading-snug text-text-tertiary">
          {factorDescription(factor)}
        </span>
        {missing > 0 && (
          <span className="font-mono text-[9px] text-text-tertiary">
            {missing} of {total} unassessed
          </span>
        )}
      </span>
      <span className="flex items-center gap-2">
        <span
          role="group"
          aria-label={`${name} weight`}
          className="flex items-center gap-[3px]"
        >
          {WEIGHT_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              // Clicking the current weight clears it: the only way to zero.
              onClick={() => onChange(step === weight ? 0 : step)}
              aria-label={`${name}: weight ${step} of ${MAX_FACTOR_WEIGHT}`}
              aria-pressed={step === weight}
              className={`h-3 w-2.5 cursor-pointer border transition-colors ${
                step <= weight
                  ? "border-accent bg-accent"
                  : "border-surface-2 hover:border-accent"
              }`}
            />
          ))}
        </span>
        <span className="w-3 text-right font-mono text-[10px] text-text-secondary tabular-nums">
          {weight}
        </span>
      </span>
    </li>
  );
}

/**
 * Recommended alternatives, ranked on weights the reader sets.
 *
 * Three steps, top to bottom: weight the factors, rank, read the result. A
 * factor the pool holds incomplete data for cannot take a weight — ranking on
 * it would order candidates by a fallback value. Nothing is listed until the
 * reader ranks, so the order on screen is always one they asked for.
 *
 * Mount with a `key` per alert: the draft weights are local state and must not
 * carry from one mine's candidates to another's.
 */
export default function AlternativesRanker({
  graph,
  appliedWeights,
  onRank,
  selectedNodeId,
  onSelectNode,
  emptyReason,
}: AlternativesRankerProps) {
  // Seeded from the applied weights, not always the default: this remounts on
  // every return to an alert, and the controls must show what the list below
  // them was ranked on.
  const [draft, setDraft] = useState<FactorWeights>(
    appliedWeights ?? DEFAULT_FACTOR_WEIGHTS,
  );

  // Counts Rank clicks, so the list can replay its sweep on each one.
  const [run, setRun] = useState(0);

  if (!graph || graph.alternatives.length === 0) {
    return (
      <p className="text-xs text-text-tertiary">
        {emptyReason ?? "No alternatives identified yet."}
      </p>
    );
  }

  const lookup = nodesById(graph);
  const renderRows = (factors: readonly string[]) => (
    <RankedList
      alternatives={graph.alternatives}
      factors={factors}
      feedsName={(nodeId) => lookup.get(nodeId)?.name}
      run={run}
      selectedNodeId={selectedNodeId}
      onSelectNode={onSelectNode}
    />
  );

  // A fixture graph carries an order and no factors, so there is nothing to
  // weight. Its list is shown as it stands.
  if (!graph.candidates) return renderRows([]);

  const factors = factorAvailability(graph.candidates);
  // A weight can outlive its factor's data: the pool is refetched when the
  // simulation year moves. Only factors still available are ever ranked on.
  const usable = Object.fromEntries(
    factors.filter((f) => f.available).map((f) => [f.factor, draft[f.factor] ?? 0]),
  );
  const draftInPlay = weighted(usable, factors);
  const dirty =
    appliedWeights !== null && !sameWeights(usable, appliedWeights, factors);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1.5 border border-surface-2 px-3 py-2.5">
        <p className="font-mono text-[9px] leading-relaxed text-text-tertiary">
          Weight what matters, 0 to {MAX_FACTOR_WEIGHT}. Weights are relative
          to one another.
        </p>
        <ul className="flex flex-col">
          {factors.map((availability) => (
            <FactorRow
              key={availability.factor}
              availability={availability}
              weight={draft[availability.factor] ?? 0}
              onChange={(weight) =>
                setDraft({ ...draft, [availability.factor]: weight })
              }
            />
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            setRun(run + 1);
            onRank(usable);
          }}
          disabled={draftInPlay.length === 0}
          className="mt-1 w-full cursor-pointer border border-accent px-3 py-1.5 font-mono text-[10px] font-medium tracking-[0.15em] text-accent uppercase transition-colors hover:bg-accent-tint disabled:cursor-not-allowed disabled:border-surface-2 disabled:text-text-tertiary disabled:hover:bg-transparent"
        >
          {draftInPlay.length === 0
            ? "Weight a factor to rank"
            : appliedWeights === null
              ? `Rank ${factors[0]?.total ?? 0} candidates`
              : "Rank again"}
        </button>
      </div>

      {appliedWeights !== null && (
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[9px] leading-relaxed text-text-tertiary">
            Ranked on{" "}
            {weighted(appliedWeights, factors).map((f, i) => (
              <span key={f.factor}>
                {i > 0 && ", "}
                {/* The swatch is the factor's segment colour in the bars below. */}
                <span
                  aria-hidden
                  className="mr-1 inline-block size-[6px]"
                  style={{ background: factorShade(f.factor) }}
                />
                {factorName(f.factor)} ×{appliedWeights[f.factor]}
              </span>
            ))}
            .
            {dirty && (
              <span className="text-accent">
                {" "}
                Weights changed since — rank again to apply.
              </span>
            )}
          </p>
          {renderRows(weighted(appliedWeights, factors).map((f) => f.factor))}
        </div>
      )}
    </div>
  );
}
