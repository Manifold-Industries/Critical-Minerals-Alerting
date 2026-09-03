import { useState } from "react";

import type { Alert, Confidence } from "@/lib/monitor/alerts";
import type { MineExposure } from "@/lib/monitor/api";
import {
  graphForAlert,
  nodesById,
  type AlertGraph,
  type ScoreFactorBreakdown,
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

// Display names for the score factors, keyed by ScoreFactor in
// api/src/disruption.py. The score breakdown is the only thing that reads them,
// so this is a name map rather than the fuller table it used to be.
const FACTOR_NAME: Record<string, string> = {
  time_to_flow: "Time to flow",
  coverage: "Coverage of the gap",
  evidence: "Evidence class",
  alignment: "Country alignment",
  commitment: "Prior commitment",
  confidence: "Assertion confidence",
};

/** Per-factor breakdown for one row's score. Rendered outside the row button,
 *  which cannot legally contain another interactive element.
 *
 *  Only the factors that built the score appear. The API returns all six so a
 *  client can tell an excluded factor from one that was never computed, but a
 *  row of zeroes explains nothing about *this* score, and under a single-factor
 *  policy five of six would be zeroes. Which factors carry weight, and which
 *  the caller excluded, is the scoring-method block's job. */
function ScoreBreakdown({
  factors,
}: {
  readonly factors: readonly ScoreFactorBreakdown[];
}) {
  const used = factors.filter((f) => f.maxContribution > 0);
  // Track widths are proportional to what each factor could contribute, so a
  // low-weight factor does not read as a failed high-weight one.
  const widest = Math.max(...used.map((f) => f.maxContribution), 1);
  return (
    <div className="flex flex-col gap-1.5 border-t border-surface-2 bg-surface-1 px-2 py-2">
      <p className="font-mono text-[9px] font-semibold tracking-[0.15em] text-accent uppercase">
        Ranking Score Breakdown
      </p>
      <ul className="flex flex-col gap-1">
        {used.map((f) => {
          const earned = f.contribution / f.maxContribution;
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
                {f.label}
                {f.known ? "" : " ?"}
              </span>
              <span className="text-right font-mono text-[9px] text-text-secondary tabular-nums">
                {f.contribution.toFixed(1)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function pct(value: number): string {
  return value >= 0.1
    ? `${Math.round(value * 100)}%`
    : `${(value * 100).toFixed(1)}%`;
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
            {ctx.affected_tpa.toLocaleString()} of{" "}
            {ctx.total_tpa.toLocaleString()} tpa disclosed at {ctx.as_of_year},
            across {ctx.refiners_disclosing} of {ctx.refiners_total} Dy/Tb
            refiners. Upper bound: the{" "}
            {ctx.refiners_total - ctx.refiners_disclosing} plants disclosing no
            nameplate are absent from the denominator.
          </p>
        </>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-foreground">
            Systemic share{" "}
            <span className="font-mono font-semibold text-accent">
              not disclosed
            </span>
          </p>
          <p className="font-mono text-[9px] leading-relaxed text-text-tertiary">
            {undisclosed === 1
              ? "The affected plant publishes"
              : `All ${undisclosed} affected plants publish`}{" "}
            no Dy+Tb nameplate. The exposure is real but unsized — not zero.
          </p>
        </>
      )}
      {ctx.affected_share != null && undisclosed > 0 && (
        <p className="font-mono text-[9px] leading-relaxed text-text-tertiary">
          Excludes {undisclosed} affected plant{undisclosed === 1 ? "" : "s"}{" "}
          with no disclosed nameplate.
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
          Carried in{" "}
          {shipped.map((m) => m.material_name ?? m.material_id).join(", ")}.
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
                <span
                  aria-hidden
                  className="ranking-caret text-[15px] leading-none text-accent"
                >
                  ▼
                </span>
                <span className="when-closed">
                  The other {rest.length}, less specific
                </span>
                <span className="when-open">Hide the other {rest.length}</span>
                <span
                  aria-hidden
                  className="ranking-caret text-[15px] leading-none text-accent"
                >
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
  // Which row has its score explanation open. Separate from `selectedNodeId`:
  // that drives the asset detail on the globe, and asking "why this score" is a
  // different question from "what is this asset".
  const [explainedId, setExplainedId] = useState<string | null>(null);
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
                          {node.place
                            ? `${node.role} · ${node.place}`
                            : node.role}
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
                              <span className="text-[9px] text-text-tertiary">
                                ·
                              </span>
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
                                {pct(node.shareOfModelledCapacity)} OF MODELLED
                                CAPACITY
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
                const explained = alt.id === explainedId;
                return (
                  <li key={alt.id} className="border-t border-surface-2">
                    {/* Two controls, two questions. The row opens the asset
                        detail; the score opens the arithmetic behind itself. */}
                    <div className="flex items-stretch">
                      <button
                        type="button"
                        onClick={() => onSelectNode(alt.id)}
                        title="Show this asset's reference detail"
                        className={`grid min-w-0 flex-1 cursor-pointer grid-cols-[18px_1fr] items-baseline gap-2 px-1 py-2 text-left transition-colors ${
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
                        </span>
                      </button>
                      {alt.score != null && (
                        <button
                          type="button"
                          onClick={() =>
                            setExplainedId(explained ? null : alt.id)
                          }
                          aria-expanded={explained}
                          title={
                            explained
                              ? "Hide how this score was reached"
                              : `Score ${alt.score.toFixed(0)} of 100 — show how it was reached`
                          }
                          className={`m-2 flex shrink-0 cursor-pointer items-center gap-1 self-center border px-2 py-1 font-mono text-[11px] font-semibold tabular-nums transition-colors ${
                            explained
                              ? "border-accent bg-accent-tint text-accent"
                              : "border-surface-2 text-foreground hover:border-accent hover:text-accent"
                          }`}
                        >
                          {alt.score.toFixed(0)}
                          <span
                            aria-hidden
                            className="ranking-caret text-[9px] leading-none text-accent"
                            style={{
                              transform: explained
                                ? "rotate(180deg)"
                                : undefined,
                            }}
                          >
                            ▼
                          </span>
                        </button>
                      )}
                    </div>
                    {/* Outside the buttons: a button cannot legally contain
                        another interactive element, and this carries titled detail. */}
                    {explained && alt.scoreFactors && (
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
