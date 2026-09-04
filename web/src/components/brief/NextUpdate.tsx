import type { Alert } from "@/lib/monitor/alerts";
import type { AlertGraph } from "@/lib/monitor/graphs";

/**
 * Section 9: when this document changes. Restates only what the panel's own
 * data says about its figures — a live graph is re-struck on every open and
 * its capacities are staged by year, a seeded graph moves only with its seed
 * — rather than promising dates the console cannot keep.
 */
export default function NextUpdate({
  alert,
  graph,
}: {
  readonly alert: Alert;
  readonly graph?: AlertGraph;
}) {
  const year = graph?.capacity?.as_of_year;
  return (
    <p className="text-[10.5px] leading-relaxed text-text-secondary">
      {alert.mineId
        ? `This brief is struck from the live supply graph each time it is opened — the same simulation the Decision Panel reads${year != null ? `, at ${year}` : ""}. Capacities are staged and supersede one another, so every share here moves with that year. Reopen the brief for current figures.`
        : "No engine behind this alert: this brief follows the seeded graph and changes only when its seed data does."}
    </p>
  );
}
