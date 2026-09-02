import type { Alert, Confidence } from "@/lib/monitor/alerts";
import {
  graphForAlert,
  nodesById,
  type AlertGraph,
} from "@/lib/monitor/graphs";
import { IMPACT_COLOR, SEVERITY_COLOR } from "@/lib/monitor/colors";

interface DecisionPanelProps {
  readonly alert: Alert;
  /** Graph fetched from the disruption API, when this alert has one. */
  readonly liveGraph?: AlertGraph;
  /** Fetch state for a live alert, so an empty panel says which kind of empty. */
  readonly loadState?: "idle" | "loading" | "error";
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (id: string) => void;
}

// The criteria the disruption simulator sorts on, in the order it applies them.
// Mirrors RankingKey in api/src/disruption.py: comparison is lexicographic, so
// the first criterion on which two candidates differ decides the order outright
// and the ones below it are never consulted. Both the info panel and the
// per-row "↓ reason" labels read from this, so they cannot drift apart.
const RANKING_CRITERIA: readonly {
  readonly field: string;
  readonly name: string;
  readonly gloss: string;
  /** Short phrase for the row that fell below its neighbour on this criterion. */
  readonly demotion: string;
}[] = [
  {
    field: "evidence_class",
    name: "Evidence class",
    gloss:
      "Curated edges outrank inferred ones. The inferred layer is five times the size of the curated one and states that it is not evidence.",
    demotion: "inferred route, not evidence",
  },
  {
    field: "time_bucket",
    name: "Time to flow",
    gloss:
      "Readiness gap plus qualification lead, bucketed at 0 / 6 / 12 / 24 months. Bucketed rather than sorted directly, because the lead months are a modelling heuristic, not a disclosed lead time. No stated start year sorts last, as unknown rather than immediate.",
    demotion: "slower to flow",
  },
  {
    field: "alignment_rank",
    name: "Country alignment",
    gloss:
      "Domestic, ally, partner, neutral, adversary. A preference, so it ranks below both feasibility criteria — above them it would float an exploration-stage project over a route that can flow now. An unassessed country sorts with neutral, not below it.",
    demotion: "less aligned",
  },
  {
    field: "coverage_rank",
    name: "Coverage of the gap",
    gloss:
      "Covers it, then unsized, then known to fall short. Unsized sits in the middle rather than last: a life-of-mine-only disclosure is missing a rate, not missing volume.",
    demotion: "weaker coverage",
  },
  {
    field: "shortfall",
    name: "Size of the shortfall",
    gloss: "Applied only among candidates already known to fall short.",
    demotion: "covers less of the gap",
  },
  {
    field: "committed",
    name: "Prior commitment",
    gloss:
      "Uncommitted before already contracted elsewhere. Ordinal, not a volume: edges carry no allocated tonnage, so free capacity cannot be computed.",
    demotion: "already committed elsewhere",
  },
  {
    field: "confidence",
    name: "Assertion confidence",
    gloss: "Confidence recorded on the edge itself.",
    demotion: "lower confidence",
  },
  {
    field: "source_id",
    name: "Asset id",
    gloss:
      "A deterministic tiebreak so orderings stay stable and testable. Rows separated only by this are tied, not ranked.",
    demotion: "tied — ordered by id",
  },
];

const DECISIVE_LABEL: Record<string, string> = Object.fromEntries(
  RANKING_CRITERIA.map((c) => [c.field, c.demotion]),
);

// Reference block replacing the ranking stub. Deliberately not "weights and
// score bars": the key is lexicographic and five of its seven substantive
// fields are ordinal, so there is no exchange rate between a qualification
// tier, a month and a tonne. A composite score would have to invent one, and
// would hide which criterion actually decided each pair.
function RankingMethod() {
  return (
    <div className="flex flex-col gap-2 border border-surface-2 px-3 py-2.5">
      <p className="font-mono text-[9px] font-semibold tracking-[0.15em] text-accent uppercase">
        How this is ranked
      </p>
      <p className="text-[10.5px] leading-relaxed text-text-secondary">
        Candidates are compared criterion by criterion in a fixed order. The
        first one on which two differ settles the order between them, and the
        rest are never consulted. There is no weighted score — no exchange rate
        exists between a qualification tier, a month and a tonne, so any
        weighting would be invented.
      </p>
      {/* Native <details>: collapses without hydration and is keyboard
          accessible without a role or handler of our own. */}
      <details className="ranking-detail flex flex-col gap-2">
        <summary className="flex cursor-pointer items-center justify-between gap-2 font-mono text-[9px] tracking-[0.15em] text-text-tertiary uppercase transition-colors hover:text-accent">
          {/* One glyph rotated 180deg rather than two swapped characters, so the
              pair stays optically identical in both states. */}
          <span aria-hidden className="ranking-caret text-[15px] leading-none text-accent">
            ▼
          </span>
          <span className="when-closed">
            The {RANKING_CRITERIA.length} criteria, in order
          </span>
          <span className="when-open">Hide the criteria</span>
          <span aria-hidden className="ranking-caret text-[15px] leading-none text-accent">
            ▼
          </span>
        </summary>
        <ol className="mt-2 flex flex-col gap-1.5">
          {RANKING_CRITERIA.map((criterion, index) => (
            <li
              key={criterion.field}
              className="grid grid-cols-[12px_1fr] gap-1.5 border-t border-surface-2 pt-1.5"
            >
              <span className="font-mono text-[9px] text-accent tabular-nums">
                {index + 1}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-mono text-[9px] tracking-[0.1em] text-foreground uppercase">
                  {criterion.name}
                </span>
                <span className="text-[10px] leading-relaxed text-text-tertiary">
                  {criterion.gloss}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-2 border-t border-surface-2 pt-1.5 text-[10px] leading-relaxed text-text-tertiary">
          <span className="text-text-secondary">Two limits.</span> Commercial
          foreclosure is invisible to the sort — a right of first refusal lives
          in edge prose, so an encumbered source can still rank highly; read the
          note on each row. And tonnages struck at different points in the chain
          are not comparable without a recovery factor the graph does not carry,
          so any coverage figure is an upper bound.
        </p>
      </details>
    </div>
  );
}

function pct(value: number): string {
  return value >= 0.1 ? `${Math.round(value * 100)}%` : `${(value * 100).toFixed(1)}%`;
}

// Systemic weight of what just lost feed. Every figure here is against
// *disclosed* capacity only, so it overstates the true share — the wording has
// to carry that, and an undisclosed plant must never read as zero.
function CapacityContext({ graph }: { readonly graph: AlertGraph }) {
  const ctx = graph.capacity;
  if (!ctx) return null;
  const undisclosed = ctx.undisclosed_facility_ids.length;

  return (
    <div className="flex flex-col gap-1.5 border border-surface-2 px-3 py-2.5">
      {ctx.affected_share != null && ctx.affected_tpa != null ? (
        <>
          <p className="text-xs leading-relaxed text-foreground">
            <span className="font-mono text-sm font-semibold text-accent tabular-nums">
              {pct(ctx.affected_share)}
            </span>{" "}
            of modelled Dy+Tb separation capacity lost feed
          </p>
          <p className="font-mono text-[9px] leading-relaxed text-text-tertiary">
            {ctx.affected_tpa.toLocaleString()} of {ctx.total_tpa.toLocaleString()} tpa
            disclosed, across {ctx.refiners_disclosing} of {ctx.refiners_total} Dy/Tb
            refiners. Upper bound: the {ctx.refiners_total - ctx.refiners_disclosing}{" "}
            plants disclosing no nameplate are absent from the denominator.
          </p>
        </>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-foreground">
            Systemic share{" "}
            <span className="font-mono font-semibold text-accent">not disclosed</span>
          </p>
          <p className="font-mono text-[9px] leading-relaxed text-text-tertiary">
            {undisclosed === 1 ? "The affected plant publishes" : `All ${undisclosed} affected plants publish`}{" "}
            no Dy+Tb nameplate. The exposure is real but unsized — not zero.
          </p>
        </>
      )}
      {ctx.affected_share != null && undisclosed > 0 && (
        <p className="font-mono text-[9px] leading-relaxed text-text-tertiary">
          Excludes {undisclosed} affected plant{undisclosed === 1 ? "" : "s"} with no
          disclosed nameplate.
        </p>
      )}
    </div>
  );
}

function statusLabel(status: string): string {
  const s = status.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Sole source" is the fact that decides whether an outage is survivable. */
function supplyLabel(node: {
  readonly soleSource?: boolean;
  readonly remainingSupplies?: number;
}): string | null {
  if (node.soleSource === undefined) return null;
  if (node.soleSource) return "Sole source";
  const n = node.remainingSupplies ?? 0;
  return `${n} other supplier${n === 1 ? "" : "s"}`;
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  HIGH: "Conf high",
  MEDIUM: "Conf med",
  LOW: "Conf low",
};

function Kicker({ children }: { readonly children: string }) {
  return (
    <h3 className="font-mono text-[9px] font-semibold tracking-[0.2em] text-accent uppercase">
      {children}
    </h3>
  );
}

// Placeholder for the quantitative internals Chris owns.
function ChrisStub({ planned }: { readonly planned: string }) {
  return (
    <div className="border border-dashed border-surface-2 px-3 py-2.5">
      <p className="font-mono text-[9px] font-semibold tracking-[0.15em] text-accent uppercase">
        For Chris to implement
      </p>
      <p className="mt-0.5 font-mono text-[9px] tracking-[0.1em] text-text-tertiary uppercase">
        {planned}
      </p>
    </div>
  );
}

// Right rail: layout scaffold for the per-alert assessment. Qualitative
// content renders from the data model; quantitative internals are stubbed.
export default function DecisionPanel({
  alert,
  liveGraph,
  loadState = "idle",
  selectedNodeId,
  onSelectNode,
}: DecisionPanelProps) {
  const graph = liveGraph ?? graphForAlert(alert.id);
  const lookup = graph ? nodesById(graph) : undefined;
  // An empty panel means three different things; saying which avoids reading
  // a failed request as a mine with no downstream exposure.
  const emptyReason =
    loadState === "loading"
      ? "Simulating disruption…"
      : loadState === "error"
        ? "Could not reach the disruption API."
        : null;

  return (
    <section className="flex min-h-0 flex-col gap-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-mono text-xs font-semibold tracking-[0.2em] text-text-secondary uppercase">
          Decision panel
        </h2>
        <p className="font-mono text-[10px] tracking-[0.15em] text-text-tertiary uppercase">
          {alert.id}
        </p>
      </div>

      <div className="blueprint flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        {/* Title block */}
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[10px] tracking-[0.15em] text-text-tertiary uppercase">
            {alert.domain} · {alert.subdomain}
          </p>
          <h3 className="flex items-start gap-2 text-base leading-[1.2] font-semibold text-foreground">
            <span
              className="mt-1.5 inline-block size-2 shrink-0"
              title={`${alert.severity} severity`}
              style={{ backgroundColor: SEVERITY_COLOR[alert.severity] }}
            />
            {alert.title}
          </h3>
          <div className="flex flex-wrap gap-1">
            <span className="tag tag-neutral">
              {CONFIDENCE_LABEL[alert.confidence]}
            </span>
            <span className="tag tag-outline">{alert.source.kind}</span>
          </div>
          {graph && (
            <p className="font-mono text-[10px] text-text-tertiary">
              {graph.asset.name} · via {alert.source.name}
            </p>
          )}
        </div>

        {/* What happened */}
        <div className="flex flex-col gap-1.5">
          <Kicker>What happened</Kicker>
          <p className="text-xs leading-relaxed text-text-secondary">
            {alert.summary}
          </p>
        </div>

        {/* Why it matters — quantitative stat row is Chris's */}
        <div className="flex flex-col gap-1.5">
          <Kicker>Why it matters</Kicker>
          {graph?.capacity && <CapacityContext graph={graph} />}
          <ChrisStub planned="Consequence · time to impact" />
        </div>

        {/* What is at risk */}
        <div className="flex flex-col gap-1.5">
          <Kicker>What is at risk</Kicker>
          {graph ? (
            <ul className="flex flex-col">
              {graph.downstream.map((node) => {
                const active = node.id === selectedNodeId;
                return (
                  <li key={node.id} className="border-t border-surface-2">
                    <button
                      type="button"
                      onClick={() => onSelectNode(node.id)}
                      title={`${node.impact} impact — show on globe`}
                      className={`grid w-full cursor-pointer grid-cols-[10px_1fr] items-baseline gap-2 px-1 py-2 text-left transition-colors ${
                        active ? "bg-accent-tint" : "hover:bg-ghost-hover"
                      }`}
                    >
                      <span
                        className="inline-block size-[7px] translate-y-px rounded-full"
                        style={{ backgroundColor: IMPACT_COLOR[node.impact] }}
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-foreground">
                          {node.name}
                        </span>
                        <span className="text-[10.5px] text-text-secondary">
                          {node.place ? `${node.role} · ${node.place}` : node.role}
                        </span>
                        {(supplyLabel(node) || node.operatingStatus) && (
                          <span className="mt-0.5 flex flex-wrap items-center gap-1">
                            {supplyLabel(node) && (
                              <span
                                className={`font-mono text-[9px] tracking-[0.1em] uppercase ${
                                  node.soleSource
                                    ? "text-accent"
                                    : "text-text-tertiary"
                                }`}
                              >
                                {supplyLabel(node)}
                              </span>
                            )}
                            {supplyLabel(node) && node.operatingStatus && (
                              <span className="text-[9px] text-text-tertiary">·</span>
                            )}
                            {node.operatingStatus && (
                              <span className="font-mono text-[9px] tracking-[0.1em] text-text-tertiary uppercase">
                                {statusLabel(node.operatingStatus)}
                              </span>
                            )}
                          </span>
                        )}
                        {(node.shareOfNameplate !== undefined ||
                          node.shareOfModelledCapacity !== undefined) && (
                          <span className="font-mono text-[9px] tracking-[0.1em] text-text-tertiary">
                            {node.shareOfNameplate !== undefined && (
                              <span title="Lost tonnage over this plant's nameplate. Upper bound — the two figures are struck at different points in the chain.">
                                {pct(node.shareOfNameplate)} OF ITS NAMEPLATE
                              </span>
                            )}
                            {node.shareOfNameplate !== undefined &&
                              node.shareOfModelledCapacity !== undefined &&
                              " · "}
                            {node.shareOfModelledCapacity !== undefined && (
                              <span title="This plant's nameplate as a share of all disclosed Dy+Tb separation capacity in the graph">
                                {pct(node.shareOfModelledCapacity)} OF MODELLED CAPACITY
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-text-tertiary">
              {emptyReason ?? "No dependency graph for this alert."}
            </p>
          )}
        </div>

        {/* Recommended alternatives */}
        <div className="flex flex-col gap-1.5">
          <Kicker>Recommended alternatives</Kicker>
          {graph && graph.alternatives.length > 0 ? (
            <ul className="flex flex-col">
              {graph.alternatives.map((alt) => {
                const feeds = lookup?.get(alt.feedsNodeId);
                const active = alt.id === selectedNodeId;
                return (
                  <li key={alt.id} className="border-t border-surface-2">
                    <button
                      type="button"
                      onClick={() => onSelectNode(alt.id)}
                      title="Show on globe (Alternatives mode)"
                      className={`grid w-full cursor-pointer grid-cols-[18px_1fr] items-baseline gap-2 px-1 py-2 text-left transition-colors ${
                        active ? "bg-accent-tint" : "hover:bg-ghost-hover"
                      }`}
                    >
                      <span className="font-mono text-[13px] font-semibold text-accent tabular-nums">
                        {alt.rank}
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-foreground">
                          {alt.name}
                        </span>
                        <span className="text-[10.5px] text-text-secondary">
                          {alt.country}
                          {feeds ? ` · feeds ${feeds.name}` : ""}
                        </span>
                        {(alt.evidenceClass !== undefined ||
                          alt.decisiveFactor) && (
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            {alt.evidenceClass !== undefined && (
                              <span
                                className={`font-mono text-[9px] tracking-[0.1em] uppercase ${
                                  alt.evidenceClass === 0
                                    ? "text-text-tertiary"
                                    : "text-accent"
                                }`}
                                title={
                                  alt.evidenceClass === 0
                                    ? "Curated edge: read from a source about this specific pair"
                                    : "Inferred edge: the two declared forms line up, which the generator states is not evidence"
                                }
                              >
                                {alt.evidenceClass === 0 ? "Curated" : "Inferred"}
                              </span>
                            )}
                            {alt.tiedWithPrevious ? (
                              <span
                                className="font-mono text-[9px] tracking-[0.1em] text-text-tertiary uppercase"
                                title="Equal to the row above on every substantive field; only the deterministic id tiebreak separates them"
                              >
                                tied — ordered by id
                              </span>
                            ) : (
                              alt.decisiveFactor && (
                                <span className="font-mono text-[9px] tracking-[0.1em] text-text-tertiary uppercase">
                                  ↓ {DECISIVE_LABEL[alt.decisiveFactor] ?? alt.decisiveFactor}
                                </span>
                              )
                            )}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-text-tertiary">
              {emptyReason ?? "No alternatives identified yet."}
            </p>
          )}
          {graph && graph.alternatives.length > 0 && <RankingMethod />}
        </div>
      </div>

      {/* Footer, outside the scroll */}
      <button
        type="button"
        className="blueprint w-full cursor-pointer px-3 py-2.5 text-center font-mono text-[11px] font-medium tracking-[0.15em] text-accent uppercase transition-colors hover:bg-accent-tint"
      >
        Generate decision brief
      </button>
    </section>
  );
}
