import type { Confidence } from "@/lib/monitor/alerts";
import type { AlertGraph } from "@/lib/monitor/graphs";
import { IMPACT_COLOR } from "@/lib/monitor/colors";
import { pct, statusLabel, supplyLabel } from "@/lib/monitor/format";
import { nodeConfidence, nodeLoss } from "@/lib/brief/derive";

const CONFIDENCE_CLASS: Record<Confidence, string> = {
  HIGH: "text-confidence-high",
  MEDIUM: "text-confidence-med",
  LOW: "text-confidence-low",
};

/**
 * Section 4: every node losing feed, with what it loses and how well that
 * claim is supported. The loss column states only what the graph states —
 * "all feed" is the sole-source fact, and a tonnage share appears only where
 * a disclosed nameplate sizes it.
 */
export default function AtRisk({ graph }: { readonly graph?: AlertGraph }) {
  if (!graph || graph.downstream.length === 0) {
    return (
      <p className="text-xs text-text-tertiary">
        No dependency graph for this alert.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {["Node", "Loss", "Conf"].map((h) => (
              <th
                key={h}
                scope="col"
                className="border-b border-surface-2 py-1.5 pr-2 font-mono text-[9px] font-semibold tracking-[0.15em] text-text-tertiary uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {graph.downstream.map((node) => {
            const conf = nodeConfidence(node);
            return (
              <tr key={node.id} className="border-b border-surface-2 align-top">
                <td className="py-2 pr-2">
                  <span className="flex items-baseline gap-1.5">
                    <span
                      aria-hidden
                      className="inline-block size-[7px] shrink-0 translate-y-px rounded-full"
                      style={{ backgroundColor: IMPACT_COLOR[node.impact] }}
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-foreground">
                        {node.name}
                      </span>
                      <span className="text-[10px] leading-snug text-text-secondary">
                        {node.place ? `${node.role} · ${node.place}` : node.role}
                      </span>
                      {node.operatingStatus && (
                        <span className="font-mono text-[9px] tracking-[0.1em] text-text-tertiary uppercase">
                          {statusLabel(node.operatingStatus)}
                        </span>
                      )}
                    </span>
                  </span>
                </td>
                <td className="py-2 pr-2">
                  <span className="flex flex-col gap-0.5">
                    <span
                      className={`font-mono text-[10px] tracking-[0.08em] uppercase ${
                        node.soleSource ? "text-accent" : "text-text-secondary"
                      }`}
                    >
                      {nodeLoss(node)}
                    </span>
                    {supplyLabel(node) && (
                      <span className="font-mono text-[9px] tracking-[0.08em] text-text-tertiary uppercase">
                        {supplyLabel(node)}
                      </span>
                    )}
                    {node.shareOfNameplate !== undefined && (
                      <span
                        className="font-mono text-[9px] text-text-tertiary"
                        title="Lost tonnage over this plant's nameplate. Upper bound — the two figures are struck at different points in the chain."
                      >
                        {pct(node.shareOfNameplate)} of nameplate
                      </span>
                    )}
                    {node.shareOfModelledCapacity !== undefined && (
                      <span
                        className="font-mono text-[9px] text-text-tertiary"
                        title="This plant's nameplate as a share of all disclosed Dy+Tb separation capacity in the graph"
                      >
                        {pct(node.shareOfModelledCapacity)} of modelled capacity
                      </span>
                    )}
                  </span>
                </td>
                <td
                  className={`py-2 font-mono text-[9px] font-semibold tracking-[0.1em] ${CONFIDENCE_CLASS[conf]}`}
                  title={
                    conf === "HIGH"
                      ? "The loss share rests on a disclosed nameplate"
                      : conf === "MEDIUM"
                        ? "Supply structure is modelled, but no disclosed nameplate sizes the loss"
                        : "Seeded fixture node — no engine claims behind it"
                  }
                >
                  {conf}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
