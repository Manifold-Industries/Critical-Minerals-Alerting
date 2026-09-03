import type { CSSProperties } from "react";
import type { Alert, Confidence } from "@/lib/monitor/alerts";
import type { MineExposure } from "@/lib/monitor/api";
import { SEVERITY_COLOR } from "@/lib/monitor/colors";
import { graphForAlert, type GeoNode } from "@/lib/monitor/graphs";
import ElementBadges from "./ElementBadges";

interface AlertQueueProps {
  readonly alerts: readonly Alert[];
  /** The disrupted asset per alert id, from the graph the globe plots. Only
   *  mine-backed alerts are in here; the rest read their placeholder fixture. */
  readonly assets: Readonly<Record<string, GeoNode>>;
  readonly assetState?: "idle" | "loading" | "error";
  /** End-use exposure by mine id. Mine-backed alerts read the minerals they
   *  are about from here rather than carrying a list of their own. */
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

/** What the alert hit: the kind of site, and which one. */
interface Entity {
  readonly label: string;
  readonly name: string;
  /** Country or place, for the tooltip: the row has no width for it. */
  readonly place: string;
}

/**
 * Minerals one alert is about, or null while there is nothing honest to show.
 *
 * A mine-backed alert has no list of its own: it reports the elements the mine
 * actually puts into the chain, in the scope the engine ran at, so it cannot
 * drift away from the exposure the panel describes. Null is deliberate — a
 * pending or failed fetch must read as "not yet known", never as "none".
 */
function mineralsFor(
  alert: Alert,
  exposures: Readonly<Record<string, MineExposure>>,
): readonly string[] | null {
  if (!alert.mineId) return alert.minerals ?? null;
  return exposures[alert.mineId]?.elements ?? null;
}

/**
 * The asset the event hit, or null while there is nothing honest to show.
 *
 * Only the directly affected one: what the outage reaches from there is a walk
 * over the supply graph, and the panel is where that belongs. A mine-backed
 * alert names a project by construction, so its label is not derived from
 * anything; a placeholder alert carries a prose role instead of a facility
 * type, and the last word of it is the nearest thing to a kind in there.
 */
function entityFor(
  alert: Alert,
  assets: Readonly<Record<string, GeoNode>>,
): Entity | null {
  if (alert.mineId) {
    const asset = assets[alert.id];
    return asset
      ? { label: "Mine", name: asset.name, place: asset.place }
      : null;
  }
  const fixture = graphForAlert(alert.id)?.asset;
  if (!fixture) return null;
  return {
    label: fixture.role.split(" ").at(-1) ?? fixture.role,
    name: fixture.name,
    place: fixture.place,
  };
}

/** Why a card names no asset: a pending fetch, a failed one, or no graph. */
function entityNotice(
  alert: Alert,
  state: "idle" | "loading" | "error",
): string {
  if (!alert.mineId) return "No modelled site";
  return state === "loading"
    ? "Resolving affected site…"
    : "Affected site unavailable";
}

export default function AlertQueue({
  alerts,
  assets,
  assetState = "idle",
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
          const minerals = mineralsFor(alert, exposures);
          const entity = entityFor(alert, assets);
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
                className={`blueprint flex w-full cursor-pointer flex-col gap-2 p-3 text-left transition-colors ${
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

                {/* What is short — the loudest thing on the card */}
                <div className="flex items-start justify-between gap-2">
                  {minerals ? (
                    <ElementBadges
                      symbols={minerals}
                      severity={alert.severity}
                    />
                  ) : (
                    <p className="font-mono text-[10px] tracking-[0.12em] text-text-tertiary uppercase">
                      {exposureState === "error"
                        ? "Elements unavailable"
                        : "Resolving elements…"}
                    </p>
                  )}
                  <span className="tag tag-neutral mt-0.5 shrink-0">
                    {CONFIDENCE_LABEL[alert.confidence]}
                  </span>
                </div>

                {/* What it hit */}
                {entity ? (
                  <div className="grid grid-cols-[72px_1fr] items-baseline gap-2">
                    <span className="truncate font-mono text-[9px] tracking-[0.1em] text-text-tertiary uppercase">
                      {entity.label}
                    </span>
                    <span
                      title={
                        entity.place
                          ? `${entity.name} · ${entity.place}`
                          : entity.name
                      }
                      className="line-clamp-2 text-[11.5px] leading-[1.25] text-foreground"
                    >
                      {entity.name}
                    </span>
                  </div>
                ) : (
                  <p className="font-mono text-[9px] tracking-[0.1em] text-text-tertiary uppercase">
                    {entityNotice(alert, assetState)}
                  </p>
                )}

                <h3 className="text-[12.5px] leading-[1.3] font-medium text-foreground">
                  {alert.title}
                </h3>
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
