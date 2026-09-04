import type { AlertGraph } from "@/lib/monitor/graphs";
import { pct } from "@/lib/monitor/format";
import { safeSummary } from "@/lib/brief/derive";

/**
 * Section 5: what the graph can honestly say stays supplied — the disclosed
 * capacity that did not lose feed, and the affected plants that keep another
 * supplier. "Safe" is a claim like any other, so it carries the same caveats
 * as the loss figures: disclosed nameplates only, buffer depth not modelled.
 */
export default function RemainsSafe({
  graph,
}: {
  readonly graph?: AlertGraph;
}) {
  if (!graph) {
    return (
      <p className="text-xs text-text-tertiary">
        No dependency graph for this alert.
      </p>
    );
  }

  const safe = safeSummary(graph);
  const nothingToSay = safe.safeShare === null && safe.buffered.length === 0;
  if (nothingToSay) {
    return (
      <p className="text-xs leading-relaxed text-text-tertiary">
        The modelled graph makes no claim about what stays supplied: every
        affected node is severed or unsized, and no disclosed capacity sits
        outside the event.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {safe.safeShare !== null && (
        <div className="flex flex-col gap-1.5 border border-surface-2 px-3 py-2.5">
          <p className="text-xs leading-relaxed text-foreground">
            <span className="font-mono text-sm font-semibold text-positive tabular-nums">
              {pct(safe.safeShare)}
            </span>{" "}
            of modelled Dy+Tb separation capacity did not lose feed
          </p>
          <p className="font-mono text-[9px] leading-relaxed text-text-tertiary">
            Disclosed nameplates at {safe.asOfYear} only
            {safe.undisclosedCount > 0
              ? ` — ${safe.undisclosedCount} affected plant${safe.undisclosedCount === 1 ? "" : "s"} with no nameplate ${safe.undisclosedCount === 1 ? "is" : "are"} outside both shares`
              : ""}
            .
          </p>
        </div>
      )}
      {safe.buffered.length > 0 && (
        <ul className="flex flex-col">
          {safe.buffered.map((node) => (
            <li
              key={node.id}
              className="flex flex-col gap-0.5 border-t border-surface-2 px-1 py-2"
            >
              <span className="text-xs font-semibold text-foreground">
                {node.name}
              </span>
              <span className="text-[10px] leading-snug text-text-secondary">
                {node.place ? `${node.role} · ${node.place}` : node.role}
              </span>
              <span className="font-mono text-[9px] tracking-[0.1em] text-positive uppercase">
                Keeps {node.remainingSupplies ?? 0} other supplier
                {(node.remainingSupplies ?? 0) === 1 ? "" : "s"} — degraded,
                not severed
              </span>
            </li>
          ))}
        </ul>
      )}
      {safe.buffered.length === 0 && (
        <p className="text-[10.5px] leading-relaxed text-text-tertiary">
          No affected node keeps another supplier: everything downstream of the
          event is sole-sourced from the disrupted asset.
        </p>
      )}
    </div>
  );
}
