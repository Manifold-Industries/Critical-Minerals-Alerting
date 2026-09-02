import type { Alert, Confidence } from "@/lib/monitor/alerts";
import { graphForAlert, nodesById } from "@/lib/monitor/graphs";
import { IMPACT_COLOR, SEVERITY_COLOR } from "@/lib/monitor/colors";

interface DecisionPanelProps {
  readonly alert: Alert;
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (id: string) => void;
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
  selectedNodeId,
  onSelectNode,
}: DecisionPanelProps) {
  const graph = graphForAlert(alert.id);
  const lookup = graph ? nodesById(graph) : undefined;

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
          <ChrisStub planned="Consequence · time to impact · systems stat row" />
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
                          {node.role} · {node.place}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-text-tertiary">
              No dependency graph for this alert.
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
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-text-tertiary">
              No alternatives identified yet.
            </p>
          )}
          <ChrisStub planned="Ranking criteria · weights · score bars" />
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
