import type { AlertGraph } from "@/lib/monitor/graphs";
import { pct } from "@/lib/monitor/format";

// Systemic weight of what just lost feed. Every figure here is against
// *disclosed* capacity only, so it overstates the true share — the wording has
// to carry that, and an undisclosed plant must never read as zero.
//
// The year is printed alongside the tonnages because capacities are staged and
// supersede one another, so these figures move with it. There is no longer a
// year control implying which one is in force, and a share with no year on it
// is not a readable number.
export default function CapacityContext({
  graph,
}: {
  readonly graph: AlertGraph;
}) {
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
