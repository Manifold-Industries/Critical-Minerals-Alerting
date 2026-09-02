import type { CSSProperties } from "react";
import type { Alert, Confidence } from "@/lib/monitor/alerts";
import type { MineExposure } from "@/lib/monitor/api";
import { SEVERITY_COLOR } from "@/lib/monitor/colors";

interface AlertQueueProps {
  readonly alerts: readonly Alert[];
  /** End-use exposure by mine id. Mine-backed alerts read their affected
   *  systems from here rather than carrying a list of their own. */
  readonly exposures: Readonly<Record<string, MineExposure>>;
  readonly exposureState?: "idle" | "loading" | "error";
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  HIGH: "Conf high",
  MEDIUM: "Conf med",
  LOW: "Conf low",
};

/**
 * Systems at risk for one alert, or null while there is nothing honest to show.
 *
 * A mine-backed alert has no list of its own: it is derived from the component
 * and platform layers, in the order the API ranked them, so it cannot drift
 * away from the graph the rest of the panel is describing. An alert with no
 * engine behind it still renders its placeholder prose. Null is deliberate —
 * a pending or failed fetch must read as "not yet known", never as a short list.
 */
function systemsFor(
  alert: Alert,
  exposures: Readonly<Record<string, MineExposure>>,
): readonly string[] | null {
  if (!alert.mineId) return alert.affectedSystems ?? null;
  const exposure = exposures[alert.mineId];
  return exposure ? exposure.platforms.map((p) => p.name) : null;
}

export default function AlertQueue({
  alerts,
  exposures,
  exposureState = "idle",
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
          const systems = systemsFor(alert, exposures);
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
                  {systems ? (
                    <>
                      Affected systems ({systems.length}) ·{" "}
                      {systems.slice(0, 2).join(", ")}
                    </>
                  ) : (
                    <span className="text-text-tertiary">
                      {exposureState === "error"
                        ? "Affected systems unavailable"
                        : "Resolving affected systems…"}
                    </span>
                  )}
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
