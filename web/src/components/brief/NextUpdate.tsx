import type { Alert } from "@/lib/monitor/alerts";
import type { AlertGraph } from "@/lib/monitor/graphs";

/**
 * Section 9: when this document changes. The brief is assembled from the live
 * graph at the moment it is opened, so "next update" is a statement about
 * what would move the figures, not a promised date the console cannot keep.
 */
export default function NextUpdate({
  alert,
  graph,
}: {
  readonly alert: Alert;
  readonly graph?: AlertGraph;
}) {
  const triggers = alert.mineId
    ? [
        `A change in the operating status of ${graph?.asset.name ?? "the disrupted asset"} or of any node in §4.`,
        "A new capacity disclosure at an affected plant — every share in this brief moves with the denominator.",
        "A recorded disposition of §7, which re-runs the simulation with the approved feed included.",
      ]
    : [
        "A live feed replacing the seeded graph behind this alert — every section here firms up or falls away with it.",
        "A recorded disposition of §7.",
      ];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10.5px] leading-relaxed text-text-secondary">
        {alert.mineId
          ? "This brief is struck from the live supply graph each time it is opened; reopen it from the Monitor console for current figures. It should be re-read on any of:"
          : "This alert has no engine behind it, so the brief changes only when its seed data does. It should be re-read on:"}
      </p>
      <ul className="flex flex-col gap-1.5">
        {triggers.map((t) => (
          <li
            key={t}
            className="grid grid-cols-[8px_1fr] gap-2 text-[10.5px] leading-relaxed text-text-secondary"
          >
            <span aria-hidden className="mt-[7px] h-[3px] w-2 bg-accent" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
