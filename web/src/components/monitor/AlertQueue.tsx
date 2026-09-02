import type { CSSProperties } from "react";
import type { Alert, Confidence } from "@/lib/monitor/alerts";
import { SEVERITY_COLOR } from "@/lib/monitor/colors";

interface AlertQueueProps {
  readonly alerts: readonly Alert[];
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  HIGH: "Conf high",
  MEDIUM: "Conf med",
  LOW: "Conf low",
};

export default function AlertQueue({
  alerts,
  selectedId,
  onSelect,
}: AlertQueueProps) {
  return (
    <section className="flex min-h-0 flex-col gap-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-mono text-xs font-semibold tracking-[0.2em] text-text-secondary uppercase">
          Alert queue
        </h2>
        <p className="font-mono text-[10px] tracking-[0.15em] text-text-tertiary uppercase">
          By severity
        </p>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {alerts.map((alert, index) => {
          const selected = alert.id === selectedId;
          return (
            <li key={alert.id}>
              <button
                type="button"
                onClick={() => onSelect(alert.id)}
                aria-pressed={selected}
                title={`${alert.severity} severity`}
                style={
                  { "--sev": SEVERITY_COLOR[alert.severity] } as CSSProperties
                }
                className={`blueprint flex w-full cursor-pointer flex-col gap-[7px] p-3 text-left transition-colors ${
                  selected
                    ? "border-accent bg-[color-mix(in_srgb,var(--sev)_26%,transparent)]"
                    : "bg-[color-mix(in_srgb,var(--sev)_14%,transparent)] hover:bg-[color-mix(in_srgb,var(--sev)_21%,transparent)]"
                }`}
              >
                <span className="sr-only">{alert.severity} severity</span>
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-mono text-[13px] font-semibold tabular-nums"
                    style={{ color: SEVERITY_COLOR[alert.severity] }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.15em] text-text-tertiary uppercase">
                    {alert.domain} · {alert.subdomain}
                  </span>
                </div>
                <h3 className="text-sm leading-[1.15] font-semibold text-foreground">
                  {alert.title}
                </h3>
                <div className="flex flex-wrap gap-1">
                  <span className="tag tag-neutral">
                    {CONFIDENCE_LABEL[alert.confidence]}
                  </span>
                </div>
                <p className="text-[11.5px] text-text-secondary">
                  Affected systems ({alert.affectedSystems.length}) ·{" "}
                  {alert.affectedSystems.slice(0, 2).join(", ")}
                </p>
                <p className="font-mono text-[10px] text-text-tertiary">
                  via {alert.source.name}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
