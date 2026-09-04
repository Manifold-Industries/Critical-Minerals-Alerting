import type { Alert } from "@/lib/monitor/alerts";
import type { MineExposure } from "@/lib/monitor/api";
import type { AlertGraph } from "@/lib/monitor/graphs";
import { SEVERITY_COLOR } from "@/lib/monitor/colors";
import {
  CONFIDENCE_LABEL,
  entityFor,
  entityNotice,
  mineralsFor,
} from "@/lib/monitor/entity";
import ElementBadges from "@/components/monitor/ElementBadges";

interface AlertSubjectProps {
  readonly alert: Alert;
  readonly graph?: AlertGraph;
  readonly exposure?: MineExposure;
  readonly exposureState: "idle" | "loading" | "error";
}

/**
 * The Decision Panel's title block at document scale: the asset the event hit,
 * the elements it is about, and the report's own grading — the same fields,
 * from the same helpers, so brief and panel introduce the same subject.
 */
export default function AlertSubject({
  alert,
  graph,
  exposure,
  exposureState,
}: AlertSubjectProps) {
  const minerals = mineralsFor(alert, exposure);
  const entity = entityFor(alert, graph);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="flex flex-col gap-1.5">
        {entity ? (
          <>
            <span className="font-mono text-[11px] tracking-[0.1em] text-text-tertiary uppercase">
              {entity.place ? `${entity.label} · ${entity.place}` : entity.label}
            </span>
            <p className="flex items-start gap-2.5 text-xl leading-tight font-semibold text-foreground">
              <span
                className="mt-2 inline-block size-2.5 shrink-0"
                title={`${alert.severity} severity`}
                style={{ backgroundColor: SEVERITY_COLOR[alert.severity] }}
              />
              {entity.name}
            </p>
          </>
        ) : (
          <p className="font-mono text-[11px] tracking-[0.1em] text-text-tertiary uppercase">
            {entityNotice(alert, "idle")}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="tag tag-neutral">
            {CONFIDENCE_LABEL[alert.confidence]}
          </span>
          <span className="tag tag-outline">{alert.source.kind}</span>
          <span className="font-mono text-[11px] text-text-tertiary">
            via {alert.source.name}
          </span>
        </div>
      </div>

      {minerals ? (
        <ElementBadges symbols={minerals} severity={alert.severity} size="lg" />
      ) : (
        <p className="font-mono text-[11px] tracking-[0.12em] text-text-tertiary uppercase">
          {exposureState === "error"
            ? "Elements unavailable"
            : "Resolving elements…"}
        </p>
      )}
    </div>
  );
}
