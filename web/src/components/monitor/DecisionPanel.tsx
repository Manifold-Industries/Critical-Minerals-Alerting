import { useState } from "react";
import Link from "next/link";

import type { Alert } from "@/lib/monitor/alerts";
import type { MineExposure } from "@/lib/monitor/api";
import {
  graphForAlert,
  nodesById,
  type AlertGraph,
  type ScoreFactorBreakdown,
} from "@/lib/monitor/graphs";
import { IMPACT_COLOR, SEVERITY_COLOR } from "@/lib/monitor/colors";
import {
  FACTOR_NAME,
  pct,
  statusLabel,
  supplyLabel,
} from "@/lib/monitor/format";
import {
  CONFIDENCE_LABEL,
  entityFor,
  entityNotice,
  mineralsFor,
} from "@/lib/monitor/entity";
import AffectedSystems from "./AffectedSystems";
import CapacityContext from "./CapacityContext";
import ElementBadges from "./ElementBadges";

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

function Kicker({ children }: { readonly children: string }) {
  return (
    <h3 className="font-mono text-[9px] font-semibold tracking-[0.2em] text-accent uppercase">
      {children}
    </h3>
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
  const minerals = mineralsFor(alert, exposure);
  const entity = entityFor(alert, graph);
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
        {/* Title block — the same elements the queue row boxes, then the asset
            the event hit, which is the subject of everything below it. */}
        <div className="flex flex-col gap-2.5">
          <p className="font-mono text-[10px] tracking-[0.15em] text-text-tertiary uppercase">
            {alert.domain} · {alert.subdomain}
          </p>

          {minerals ? (
            <ElementBadges
              symbols={minerals}
              severity={alert.severity}
              size="lg"
            />
          ) : (
            <p className="font-mono text-[10px] tracking-[0.12em] text-text-tertiary uppercase">
              {exposureState === "error"
                ? "Elements unavailable"
                : "Resolving elements…"}
            </p>
          )}

          {entity ? (
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[9px] tracking-[0.1em] text-text-tertiary uppercase">
                {entity.place
                  ? `${entity.label} · ${entity.place}`
                  : entity.label}
              </span>
              <p className="flex items-start gap-2 text-[15px] leading-[1.2] font-semibold text-foreground">
                <span
                  className="mt-1.5 inline-block size-2 shrink-0"
                  title={`${alert.severity} severity`}
                  style={{ backgroundColor: SEVERITY_COLOR[alert.severity] }}
                />
                {entity.name}
              </p>
            </div>
          ) : (
            <p className="font-mono text-[9px] tracking-[0.1em] text-text-tertiary uppercase">
              {entityNotice(alert, loadState)}
            </p>
          )}

          <h3 className="text-[13px] leading-[1.35] font-medium text-text-secondary">
            {alert.title}
          </h3>

          <div className="flex flex-wrap gap-1">
            <span className="tag tag-neutral">
              {CONFIDENCE_LABEL[alert.confidence]}
            </span>
            <span className="tag tag-outline">{alert.source.kind}</span>
          </div>
          <p className="font-mono text-[10px] text-text-tertiary">
            via {alert.source.name}
          </p>
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
                            className="disclosure-caret text-[9px] leading-none text-accent"
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

      {/* Footer, outside the scroll. A link, not a button: the brief is its
          own page, addressable by alert id, so it can be shared and reloaded. */}
      <Link
        href={`/brief?alert=${alert.id}`}
        title="Assemble this alert into a decision brief"
        className="blueprint block w-full px-3 py-2.5 text-center font-mono text-[11px] font-medium tracking-[0.15em] text-accent uppercase transition-colors hover:bg-accent-tint"
      >
        Generate decision brief
      </Link>
    </section>
  );
}
