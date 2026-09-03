import type { Alert, Confidence } from "@/lib/monitor/alerts";
import type { MineExposure } from "@/lib/monitor/api";
import {
  graphForAlert,
  nodesById,
  type AlertGraph,
  type ScoreFactorBreakdown,
  type ScoringPolicy,
} from "@/lib/monitor/graphs";
import { IMPACT_COLOR, SEVERITY_COLOR } from "@/lib/monitor/colors";

interface DecisionPanelProps {
  readonly alert: Alert;
  /** Graph fetched from the disruption API, when this alert has one. */
  readonly liveGraph?: AlertGraph;
  /** End uses this mine's Dy/Tb reaches, from `/exposure/{mineId}`. */
  readonly exposure?: MineExposure;
  /** Fetch state for the exposure request, kept apart from the graph's: the
   *  two are separate calls and either can fail without the other. */
  readonly exposureState?: "idle" | "loading" | "error";
  /** Fetch state for a live alert, so an empty panel says which kind of empty. */
  readonly loadState?: "idle" | "loading" | "error";
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (id: string) => void;
}

// The factors the disruption simulator scores on. Mirrors ScoreFactor and
// DEFAULT_WEIGHTS in api/src/disruption.py: each is normalised to [0, 1] with 1
// as best, weighted, and renormalised over the weights actually in play, so the
// score is 0-100 whatever was excluded. Listed in default-weight order. Both the
// info panel and the per-row labels read from this, so they cannot drift apart.
const SCORE_FACTORS: readonly {
  readonly factor: string;
  readonly name: string;
  readonly gloss: string;
  /** Short phrase for the row that gave away the most points here. */
  readonly demotion: string;
}[] = [
  {
    factor: "time_to_flow",
    name: "Time to flow",
    gloss:
      "Readiness gap plus qualification lead, bucketed at 0 / 6 / 12 / 24 months. Bucketed rather than scored on the raw months, because the lead months are a modelling heuristic, not a disclosed lead time. No stated start year scores below every known bucket, as unknown rather than immediate.",
    demotion: "slower to flow",
  },
  {
    factor: "coverage",
    name: "Coverage of the gap",
    gloss:
      "Full marks for covering it, half for unsized, and a known partial scores under both in proportion to what it covers. Unsized sits in the middle rather than at zero: a life-of-mine-only disclosure is missing a rate, not missing volume.",
    demotion: "covers less of the gap",
  },
  {
    factor: "evidence",
    name: "Evidence class",
    gloss:
      "Full marks for a curated edge, none for an inferred one. The inferred layer is five times the size of the curated one and states that it is not evidence — but this is weighted now, not absolute, so a strong inferred route can outrank a weak curated one.",
    demotion: "inferred route, not evidence",
  },
  {
    factor: "alignment",
    name: "Country alignment",
    gloss:
      "Domestic, ally, partner, neutral, adversary. A preference rather than a feasibility fact, which is why it carries less weight than either. An unassessed country scores with neutral, not below it.",
    demotion: "less aligned",
  },
  {
    factor: "commitment",
    name: "Prior commitment",
    gloss:
      "Uncommitted scores above already contracted elsewhere. All or nothing, not a volume: edges carry no allocated tonnage, so free capacity cannot be computed.",
    demotion: "already committed elsewhere",
  },
  {
    factor: "confidence",
    name: "Assertion confidence",
    gloss: "Confidence recorded on the edge itself.",
    demotion: "lower confidence",
  },
];

const FACTOR_NAME: Record<string, string> = Object.fromEntries(
  SCORE_FACTORS.map((f) => [f.factor, f.name]),
);

const DECISIVE_LABEL: Record<string, string> = Object.fromEntries(
  SCORE_FACTORS.map((f) => [f.factor, f.demotion]),
);

// RankingKey fields, used only where two rows scored exactly the same and the
// lexicographic tiebreak had to separate them. Not a scoring vocabulary: these
// name what broke a tie, never what won points.
const TIEBREAK_LABEL: Record<string, string> = {
  evidence_class: "evidence class",
  time_bucket: "time to flow",
  alignment_rank: "country alignment",
  coverage_rank: "coverage",
  shortfall: "size of the shortfall",
  committed: "prior commitment",
  confidence: "assertion confidence",
  source_id: "id",
};

/** The chip under a row saying why it sits below the one above it. */
function decisiveLabel(alt: {
  readonly decisiveBasis?: string | null;
  readonly decisiveFactor?: string | null;
  readonly decisiveMargin?: number | null;
}): string | null {
  if (!alt.decisiveFactor) return null;
  if (alt.decisiveBasis === "TIEBREAK") {
    return alt.decisiveFactor === "source_id"
      ? "tied — ordered by id"
      : `tied on score — ordered by ${TIEBREAK_LABEL[alt.decisiveFactor] ?? alt.decisiveFactor}`;
  }
  const name = DECISIVE_LABEL[alt.decisiveFactor] ?? alt.decisiveFactor;
  // The margin is the point of showing a score at all: 0.4 points behind and 30
  // points behind are both "ranked lower" and must not read alike.
  return alt.decisiveMargin != null
    ? `↓ ${alt.decisiveMargin.toFixed(1)} pts · ${name}`
    : `↓ ${name}`;
}

/** Per-factor breakdown for the selected row. Rendered outside the row button,
 *  which cannot legally contain another interactive element. */
function ScoreBreakdown({
  factors,
}: {
  readonly factors: readonly ScoreFactorBreakdown[];
}) {
  // Track widths are proportional to what each factor could contribute, so a
  // low-weight factor does not read as a failed high-weight one.
  const widest = Math.max(...factors.map((f) => f.maxContribution), 1);
  return (
    <ul className="flex flex-col gap-1 border-t border-surface-2 bg-surface-1 px-2 py-2">
      {factors.map((f) => {
        const earned = f.maxContribution > 0 ? f.contribution / f.maxContribution : 0;
        return (
          <li
            key={f.factor}
            // The bar gets a fixed cell rather than sharing flex space with the
            // label: the widest track would otherwise squeeze the label out
            // entirely, and the "?" that marks a fallback with it.
            className="grid grid-cols-[70px_52px_1fr_26px] items-center gap-2"
            title={
              f.detail ??
              `${f.contribution.toFixed(1)} of ${f.maxContribution.toFixed(1)} available points`
            }
          >
            <span className="font-mono text-[9px] tracking-[0.1em] text-text-tertiary uppercase">
              {FACTOR_NAME[f.factor] ?? f.factor}
            </span>
            <span aria-hidden className="block">
              {/* Track width is proportional to what the factor could contribute,
                  so a low-weight factor does not read as a failed high-weight one. */}
              <span
                className="block h-[3px] bg-surface-2"
                style={{ width: `${(f.maxContribution / widest) * 100}%` }}
              >
                {/* Grey rather than accent where the value is a fallback, so a
                    guess never renders with the authority of a disclosure. */}
                <span
                  className={`block h-full ${f.known ? "bg-accent" : "bg-text-tertiary"}`}
                  style={{ width: `${earned * 100}%` }}
                />
              </span>
            </span>
            <span
              className={`truncate font-mono text-[9px] ${
                f.known ? "text-text-tertiary" : "text-text-secondary"
              }`}
              title={f.known ? undefined : (f.detail ?? undefined)}
            >
              {f.maxContribution > 0 ? f.label : "excluded"}
              {f.known ? "" : " ?"}
            </span>
            <span className="text-right font-mono text-[9px] text-text-secondary tabular-nums">
              {f.contribution.toFixed(1)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// Reference block for the scoring method. The weights are the load-bearing
// disclosure here: there is no exchange rate between a qualification tier, a
// month and a tonne, so the API invents one and says so. Read from
// `graph.scoring` rather than hardcoded, or this block can quietly describe a
// policy the response was not computed under.
function RankingMethod({ scoring }: { readonly scoring: ScoringPolicy }) {
  const excluded = scoring.excludedFactors;
  const total = Object.values(scoring.weights).reduce((sum, w) => sum + w, 0);
  return (
    <div className="flex flex-col gap-2 border border-surface-2 px-3 py-2.5">
      <p className="font-mono text-[9px] font-semibold tracking-[0.15em] text-accent uppercase">
        How this is ranked
      </p>
      <p className="text-[10.5px] leading-relaxed text-text-secondary">
        Each candidate scores out of 100. Six factors are normalised so that 1 is
        always best, weighted, and renormalised over whatever is in play, so a
        strong showing on one factor can outweigh a weak one on another. The
        points below every row are the whole of the score, not a summary of it.
      </p>
      <p className="text-[10.5px] leading-relaxed text-text-tertiary">
        <span className="text-text-secondary">The weights are invented.</span> No
        exchange rate exists between a qualification tier, a month and a tonne,
        so they are a stated position rather than a derived result (
        {scoring.version}). That is also why every factor is shown separately:
        the ordering can be disagreed with, factor by factor.
      </p>
      {excluded.length > 0 && (
        <p className="text-[10.5px] leading-relaxed text-caution">
          {excluded.map((f) => FACTOR_NAME[f] ?? f).join(" and ")}{" "}
          {excluded.length === 1 ? "is" : "are"} excluded from these scores. The
          remaining weights were renormalised, so the numbers are still out of
          100 but are not the same measurement as a default run.
        </p>
      )}
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
            The {SCORE_FACTORS.length} factors, and their weights
          </span>
          <span className="when-open">Hide the factors</span>
          <span aria-hidden className="ranking-caret text-[15px] leading-none text-accent">
            ▼
          </span>
        </summary>
        <ol className="mt-2 flex flex-col gap-1.5">
          {SCORE_FACTORS.map((factor) => {
            const weight = scoring.weights[factor.factor];
            const share = weight != null && total > 0 ? weight / total : null;
            const dropped = excluded.includes(factor.factor);
            return (
              <li
                key={factor.factor}
                className="grid grid-cols-[30px_1fr] gap-1.5 border-t border-surface-2 pt-1.5"
              >
                {/* The weight, not a position: order no longer decides anything
                    on its own, so numbering the list would misdescribe it. */}
                <span
                  className={`font-mono text-[9px] tabular-nums ${
                    dropped ? "text-text-tertiary line-through" : "text-accent"
                  }`}
                >
                  {share != null ? `${Math.round(share * 100)}pts` : "—"}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-mono text-[9px] tracking-[0.1em] text-foreground uppercase">
                    {factor.name}
                  </span>
                  <span className="text-[10px] leading-relaxed text-text-tertiary">
                    {factor.gloss}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 border-t border-surface-2 pt-1.5 text-[10px] leading-relaxed text-text-tertiary">
          <span className="text-text-secondary">Three limits.</span> Commercial
          foreclosure is invisible to the score — a right of first refusal lives
          in edge prose, so an encumbered source can still score highly; read the
          note on each row. Tonnages struck at different points in the chain are
          not comparable without a recovery factor the graph does not carry, so
          any coverage figure is an upper bound. And a factor marked{" "}
          <span className="font-mono">?</span> scored on a fallback rather than a
          disclosure: the points are real, the basis for them is not.
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
//
// The year is printed alongside the tonnages because capacities are staged and
// supersede one another, so these figures move with it. There is no longer a
// year control implying which one is in force, and a share with no year on it
// is not a readable number.
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
            disclosed at {ctx.as_of_year}, across {ctx.refiners_disclosing} of{" "}
            {ctx.refiners_total} Dy/Tb refiners. Upper bound: the{" "}
            {ctx.refiners_total - ctx.refiners_disclosing} plants disclosing no
            nameplate are absent from the denominator.
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

// How many end uses to show before the rest go behind a disclosure. The panel
// is a decision aid, not a catalogue: at the current Dy/Tb scope a mine reaches
// fourteen platforms, which would push everything below "Why it matters" off
// the first screen.
const SYSTEMS_SHOWN = 5;

// Only the kinds a reader could over-read are labelled. A PLATFORM is the most
// specific claim the source can make and needs no qualifier; a CATEGORY names
// no single hull or airframe, and a SUBSYSTEM is a part of one, so both say so.
const KIND_LABEL: Record<string, string> = {
  SUBSYSTEM: "Subsystem",
  CATEGORY: "Class",
};

/** One end use, with the components that carry the mine's elements into it. */
function SystemRow({
  platform,
}: {
  readonly platform: MineExposure["platforms"][number];
}) {
  const kind = KIND_LABEL[platform.kind];
  // Not the platform's own name: the parent is named only so a subsystem does
  // not read as a whole hull. The graph carries no claim that losing the
  // subsystem stops the parent, so the parent is not itself listed as at risk.
  const parent =
    platform.kind === "SUBSYSTEM" && platform.parent_name
      ? `of ${platform.parent_name}`
      : null;

  return (
    <li className="flex flex-col gap-0.5 border-t border-surface-2 px-1 py-2">
      <span className="flex items-baseline gap-1.5">
        <span className="text-xs font-semibold text-foreground">
          {platform.name}
        </span>
        {kind && <span className="tag tag-outline">{kind}</span>}
      </span>
      <span className="text-[10.5px] leading-snug text-text-secondary">
        via {platform.via_components.map((c) => c.name).join(", ")}
      </span>
      <span className="mt-0.5 flex flex-wrap items-center gap-1 font-mono text-[9px] tracking-[0.1em] text-text-tertiary uppercase">
        {parent && <span>{parent}</span>}
        {parent && <span>·</span>}
        {/* Exempt from the row's uppercase: element symbols are case-significant,
            and "DY" is not how dysprosium is written. */}
        <span className="normal-case">{platform.elements.join("/")}</span>
        <span>·</span>
        <span
          title="Weakest assertion on the two-edge path actually used — not a joint probability"
          className={platform.confidence === "HIGH" ? undefined : "text-accent"}
        >
          {platform.confidence ? `Conf ${platform.confidence}` : "Conf unrated"}
        </span>
      </span>
    </li>
  );
}

/**
 * End uses reached by the elements this mine puts into the chain.
 *
 * Replaces a stub, and deliberately does not replace it with a consequence
 * figure: sizing a shortfall needs a demand side, and the graph has none. What
 * it can say is which components cannot be built without this element and which
 * platform classes are asserted to need them — a statement about what is at
 * stake, not about how much.
 *
 * Two things the wording has to keep carrying. These are functional dependency
 * claims about *classes*: bills of material are classified, and nothing here
 * says metal from this mine reached a particular airframe. And it is not a
 * routed path — whether this mine's Dy ever reaches a separator is what the
 * disruption graph above answers, not this.
 */
function AffectedSystems({
  exposure,
  state,
}: {
  readonly exposure?: MineExposure;
  readonly state: "idle" | "loading" | "error";
}) {
  if (!exposure) {
    return (
      <p className="text-xs text-text-tertiary">
        {state === "loading"
          ? "Resolving end-use exposure…"
          : state === "error"
            ? "Could not reach the exposure API."
            : "No mine behind this alert, so no end use can be derived."}
      </p>
    );
  }

  const { platforms } = exposure;
  const shipped = exposure.source_materials.filter((m) => m.shipped);
  const shown = platforms.slice(0, SYSTEMS_SHOWN);
  const rest = platforms.slice(SYSTEMS_SHOWN);

  return (
    <div className="flex flex-col gap-1.5 border border-surface-2 px-3 py-2.5">
      <p className="text-xs leading-relaxed text-foreground">
        <span className="font-mono text-sm font-semibold text-accent tabular-nums">
          {platforms.length}
        </span>{" "}
        weapons system{platforms.length === 1 ? "" : "s"} depend on{" "}
        {exposure.elements.join(" and ")}
      </p>
      {shipped.length > 0 && (
        <p className="font-mono text-[9px] leading-relaxed text-text-tertiary">
          Carried in {shipped.map((m) => m.material_name ?? m.material_id).join(", ")}.
        </p>
      )}

      {platforms.length === 0 ? (
        <p className="text-[10.5px] leading-relaxed text-text-secondary">
          No modelled component requires what this mine carries. The end-use
          layer is incomplete, not empty.
        </p>
      ) : (
        <>
          <ul className="flex flex-col">
            {shown.map((platform) => (
              <SystemRow key={platform.platform_id} platform={platform} />
            ))}
          </ul>
          {rest.length > 0 && (
            <details className="ranking-detail flex flex-col">
              <summary className="flex cursor-pointer items-center justify-between gap-2 border-t border-surface-2 pt-2 font-mono text-[9px] tracking-[0.15em] text-text-tertiary uppercase transition-colors hover:text-accent">
                <span aria-hidden className="ranking-caret text-[15px] leading-none text-accent">
                  ▼
                </span>
                <span className="when-closed">
                  The other {rest.length}, less specific
                </span>
                <span className="when-open">Hide the other {rest.length}</span>
                <span aria-hidden className="ranking-caret text-[15px] leading-none text-accent">
                  ▼
                </span>
              </summary>
              <ul className="flex flex-col">
                {rest.map((platform) => (
                  <SystemRow key={platform.platform_id} platform={platform} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      <p className="border-t border-surface-2 pt-1.5 text-[10px] leading-relaxed text-text-tertiary">
        <span className="text-text-secondary">What this is.</span> Open-source
        claims that a system <em>class</em> uses a component class — bills of
        material are classified, so nothing here says metal from this mine
        reached a particular airframe. Nor is it a routed path: whether this
        mine&rsquo;s output reaches a separator is what the dependency graph
        below answers.
      </p>
      {exposure.warnings.map((warning) => (
        <p
          key={warning}
          className="text-[10px] leading-relaxed text-text-tertiary"
        >
          <span className="text-accent">Note.</span> {warning}
        </p>
      ))}
    </div>
  );
}

// Right rail: layout scaffold for the per-alert assessment. Qualitative
// content renders from the data model; quantitative internals are stubbed.
export default function DecisionPanel({
  alert,
  liveGraph,
  exposure,
  exposureState = "idle",
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

        {/* Why it matters — systemic weight, then what depends on the element */}
        <div className="flex flex-col gap-1.5">
          <Kicker>Why it matters</Kicker>
          {graph?.capacity && <CapacityContext graph={graph} />}
          <AffectedSystems exposure={exposure} state={exposureState} />
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
                const decisive = decisiveLabel(alt);
                return (
                  <li key={alt.id} className="border-t border-surface-2">
                    <button
                      type="button"
                      onClick={() => onSelectNode(alt.id)}
                      title={
                        alt.score != null
                          ? `Score ${alt.score.toFixed(1)} of 100. Select to see the factors behind it.`
                          : "Show on globe (Alternatives mode)"
                      }
                      className={`grid w-full cursor-pointer grid-cols-[18px_1fr_auto] items-baseline gap-2 px-1 py-2 text-left transition-colors ${
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
                        {alt.score != null && (
                          <span
                            aria-hidden
                            className="mt-0.5 h-[2px] w-full bg-surface-2"
                          >
                            <span
                              className="block h-full bg-accent"
                              style={{ width: `${alt.score}%` }}
                            />
                          </span>
                        )}
                        {(alt.evidenceClass !== undefined || decisive) && (
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
                            {decisive && (
                              <span
                                className="font-mono text-[9px] tracking-[0.1em] text-text-tertiary uppercase"
                                title={
                                  alt.tiedWithPrevious
                                    ? "The score could not separate this row from the one above; a deterministic tiebreak did, so the two are tied rather than ranked"
                                    : "The factor that gave away the most points against the row above. A composite has no single reason for an order, so this is the largest one, not all of it."
                                }
                              >
                                {decisive}
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                      {alt.score != null && (
                        <span
                          className="self-center font-mono text-[11px] font-semibold text-foreground tabular-nums"
                          title="Score out of 100, higher is better"
                        >
                          {alt.score.toFixed(0)}
                        </span>
                      )}
                    </button>
                    {/* Outside the button: a row cannot legally contain another
                        interactive element, and this carries titled detail. */}
                    {active && alt.scoreFactors && (
                      <ScoreBreakdown factors={alt.scoreFactors} />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-text-tertiary">
              {emptyReason ?? "No alternatives identified yet."}
            </p>
          )}
          {graph && graph.alternatives.length > 0 && graph.scoring && (
            <RankingMethod scoring={graph.scoring} />
          )}
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
