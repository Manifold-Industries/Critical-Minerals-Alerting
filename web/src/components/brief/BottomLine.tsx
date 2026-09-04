import type { Alert } from "@/lib/monitor/alerts";
import type { MineExposure } from "@/lib/monitor/api";
import type { AlertGraph } from "@/lib/monitor/graphs";
import { SEVERITY_COLOR } from "@/lib/monitor/colors";
import {
  bluf,
  consequenceStat,
  timeToImpactStat,
  type BriefStat,
} from "@/lib/brief/derive";

interface BottomLineProps {
  readonly alert: Alert;
  readonly graph?: AlertGraph;
  readonly exposure?: MineExposure;
}

/** One stat cell: a short value over the caveat that keeps it honest. */
function Stat({
  label,
  stat,
  swatch,
}: {
  readonly label: string;
  readonly stat: BriefStat;
  /** Colour square beside the value — severity only, matching the panel. */
  readonly swatch?: string;
}) {
  return (
    <div className="flex flex-col gap-1 border border-surface-2 px-3 py-2">
      <p className="font-mono text-[9px] font-semibold tracking-[0.15em] text-text-tertiary uppercase">
        {label}
      </p>
      <p className="flex items-center gap-1.5 font-mono text-sm font-semibold text-foreground tabular-nums">
        {swatch && (
          <span
            aria-hidden
            className="inline-block size-2 shrink-0"
            style={{ backgroundColor: swatch }}
          />
        )}
        {stat.value}
      </p>
      <p className="font-mono text-[9px] leading-relaxed text-text-tertiary">
        {stat.detail}
      </p>
    </div>
  );
}

/** Section 1: the BLUF, then the four figures a reader would scan for. */
export default function BottomLine({ alert, graph, exposure }: BottomLineProps) {
  const severity: BriefStat = {
    value: alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1),
    detail: "as triaged on the alert queue",
  };
  const confidence: BriefStat = {
    value: alert.confidence,
    detail: "in the event report itself — per-claim grades are in §3 and §4",
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] leading-relaxed text-foreground">
        {bluf(alert, graph, exposure)}
      </p>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Consequence" stat={consequenceStat(graph)} />
        <Stat
          label="Severity"
          stat={severity}
          swatch={SEVERITY_COLOR[alert.severity]}
        />
        <Stat label="Confidence" stat={confidence} />
        <Stat label="Time to impact" stat={timeToImpactStat(graph)} />
      </div>
    </div>
  );
}
