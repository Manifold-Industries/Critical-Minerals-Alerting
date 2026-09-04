import type { Alert } from "@/lib/monitor/alerts";
import type { MineExposure } from "@/lib/monitor/api";
import type { AlertGraph } from "@/lib/monitor/graphs";
import { decisionRequest } from "@/lib/brief/derive";

/** One disposition and what it does, coloured by what it leaves standing. */
function Effect({
  label,
  labelClass,
  children,
}: {
  readonly label: string;
  readonly labelClass: string;
  readonly children: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 border border-surface-2 px-3 py-2.5">
      <p
        className={`font-mono text-[11px] font-semibold tracking-[0.15em] uppercase ${labelClass}`}
      >
        {label}
      </p>
      <p className="text-[13px] leading-relaxed text-text-secondary">
        {children}
      </p>
    </div>
  );
}

/**
 * Section 7 — the one field a decision-maker actually signs. Everything is in
 * a single steel-ruled block: the ask, the deadline, what each disposition
 * does, and what happens on approval. Steel rather than amber so the field
 * reads as the document's signature line, not another alert accent.
 */
export default function DecisionRequested({
  alert,
  graph,
  exposure,
}: {
  readonly alert: Alert;
  readonly graph?: AlertGraph;
  readonly exposure?: MineExposure;
}) {
  const d = decisionRequest(alert, graph, exposure);

  return (
    <div className="flex flex-col gap-4 border-y-2 border-text-secondary bg-surface-1 px-5 py-4">
      <p className="max-w-4xl text-base leading-relaxed font-medium text-foreground">
        {d.ask}
      </p>
      <p className="font-mono text-xs leading-relaxed text-text-secondary">
        <span className="font-semibold tracking-[0.15em] text-accent uppercase">
          Deadline ·{" "}
        </span>
        {d.deadline}
      </p>
      <div className="grid gap-2.5 sm:grid-cols-3">
        <Effect label="Approve" labelClass="text-positive">
          {d.approve}
        </Effect>
        <Effect label="Defer" labelClass="text-confidence-med">
          {d.defer}
        </Effect>
        <Effect label="No action" labelClass="text-negative">
          {d.noAction}
        </Effect>
      </div>
      {d.onApproval.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-[11px] font-semibold tracking-[0.15em] text-accent uppercase">
            On approval
          </p>
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13px] leading-relaxed text-text-secondary marker:font-mono marker:text-xs marker:text-text-tertiary">
            {d.onApproval.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
