import type { Alert } from "@/lib/monitor/alerts";
import type { MineExposure } from "@/lib/monitor/api";
import type { AlertGraph } from "@/lib/monitor/graphs";
import { assumptions } from "@/lib/brief/derive";

/**
 * Section 8: what the assessment leans on and where the graph is silent —
 * the same caveats the panel scatters through its sections, gathered where a
 * decision-maker will read them before signing §7.
 */
export default function AssumptionsSection({
  alert,
  graph,
  exposure,
}: {
  readonly alert: Alert;
  readonly graph?: AlertGraph;
  readonly exposure?: MineExposure;
}) {
  const items = assumptions(alert, graph, exposure);
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="grid grid-cols-[8px_1fr] gap-2 text-[10.5px] leading-relaxed text-text-secondary"
        >
          <span aria-hidden className="mt-[7px] h-[3px] w-2 bg-accent" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
