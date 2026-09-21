import { pct, statusLabel, supplyLabel } from "@/lib/monitor/format";
import type { AlertGraph } from "@/lib/monitor/graphs";
import {
  BRIEF_TABLE,
  BRIEF_TD,
  BRIEF_TD_NAME,
  BRIEF_TH,
  BriefNotice,
} from "./BriefSection";

/** A share, or a dash: an undisclosed nameplate must never print as 0%. */
function share(value: number | undefined): string {
  return value === undefined ? "—" : pct(value);
}

/**
 * Section 4: the plants that lose feed, in the order the disruption reaches
 * them. "Sole source" is the fact that decides whether an outage is survivable,
 * so it is the one cell in the table given the accent.
 */
export default function BriefAtRisk({
  graph,
  emptyReason,
}: {
  readonly graph?: AlertGraph;
  readonly emptyReason: string;
}) {
  if (!graph) return <BriefNotice>{emptyReason}</BriefNotice>;
  if (graph.downstream.length === 0) {
    return (
      <BriefNotice>
        No modelled plant takes feed from this site, so the disruption reaches
        nothing the graph can name.
      </BriefNotice>
    );
  }
  const live = graph.candidates !== undefined;

  return (
    <>
      <table className={BRIEF_TABLE}>
        <thead>
          <tr>
            <th className={BRIEF_TH}>Plant</th>
            <th className={BRIEF_TH}>Role</th>
            <th className={BRIEF_TH}>Other supply</th>
            <th className={BRIEF_TH}>Status</th>
            {live && <th className={`${BRIEF_TH} text-right`}>Of its nameplate</th>}
            {live && (
              <th className={`${BRIEF_TH} text-right`}>Of modelled capacity</th>
            )}
          </tr>
        </thead>
        <tbody>
          {graph.downstream.map((node) => (
            <tr key={node.id}>
              <td className={BRIEF_TD_NAME}>
                {node.name}
                {node.place && (
                  <span className="block text-[10px] font-normal text-text-tertiary">
                    {node.place}
                  </span>
                )}
              </td>
              <td className={BRIEF_TD}>{node.role}</td>
              <td
                className={`${BRIEF_TD} whitespace-nowrap ${node.soleSource ? "font-semibold text-accent" : ""}`}
              >
                {supplyLabel(node) ?? "—"}
              </td>
              <td className={BRIEF_TD}>
                {node.operatingStatus ? statusLabel(node.operatingStatus) : "—"}
              </td>
              {live && (
                <td className={`${BRIEF_TD} text-right font-mono tabular-nums`}>
                  {share(node.shareOfNameplate)}
                </td>
              )}
              {live && (
                <td className={`${BRIEF_TD} text-right font-mono tabular-nums`}>
                  {share(node.shareOfModelledCapacity)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {live && (
        <p className="text-[10.5px] leading-relaxed text-text-tertiary">
          &ldquo;Of its nameplate&rdquo; is lost tonnage over the plant&rsquo;s
          own capacity, an upper bound because the two are struck at different
          points in the chain. &ldquo;Of modelled capacity&rdquo; is the
          plant&rsquo;s share of all disclosed Dy/Tb separation capacity. A dash
          is an undisclosed figure, not zero.
        </p>
      )}
    </>
  );
}
