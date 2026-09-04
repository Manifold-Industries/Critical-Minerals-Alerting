"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  ALERTS,
  sortBySeverity,
  WATCH_NAME,
  type Alert,
} from "@/lib/monitor/alerts";
import {
  fetchDisruption,
  fetchExposure,
  toAlertGraph,
  type MineExposure,
} from "@/lib/monitor/api";
import { graphForAlert, type AlertGraph } from "@/lib/monitor/graphs";
import { basisLine, rankingCriterion } from "@/lib/brief/derive";
import AffectedSystems from "@/components/monitor/AffectedSystems";
import CapacityContext from "@/components/monitor/CapacityContext";
import AlternativesSection from "./AlternativesSection";
import AssumptionsSection from "./AssumptionsSection";
import AtRisk from "./AtRisk";
import BottomLine from "./BottomLine";
import BriefHeader from "./BriefHeader";
import BriefSection from "./BriefSection";
import DecisionRequested from "./DecisionRequested";
import MemoHeader from "./MemoHeader";
import NextUpdate from "./NextUpdate";
import RemainsSafe from "./RemainsSafe";

type LoadState = "idle" | "loading" | "error";

/** A notice standing in for the memo body, so an empty page says which empty. */
function BriefNotice({ children }: { readonly children: string }) {
  return (
    <p className="border-t border-surface-2 pt-4 text-xs leading-relaxed text-text-tertiary">
      {children}
    </p>
  );
}

/** The numbered sections, once whatever graph the alert has is in hand. */
function BriefBody({
  alert,
  graph,
  exposure,
  exposureState,
}: {
  readonly alert: Alert;
  readonly graph?: AlertGraph;
  readonly exposure?: MineExposure;
  readonly exposureState: LoadState;
}) {
  const criterion = rankingCriterion(graph?.scoring);
  return (
    <>
      <BriefSection no={1} title="Bottom line">
        <BottomLine alert={alert} graph={graph} exposure={exposure} />
      </BriefSection>

      {/* §2 and §3 verbatim from the decision panel: the same summary, the
          same capacity and end-use blocks, so brief and panel cannot drift. */}
      <BriefSection no={2} title="What happened">
        <p className="text-xs leading-relaxed text-text-secondary">
          {alert.summary}
        </p>
      </BriefSection>

      <BriefSection no={3} title="Why it matters">
        {graph?.capacity && <CapacityContext graph={graph} />}
        <AffectedSystems exposure={exposure} state={exposureState} />
      </BriefSection>

      <div className="grid gap-5 lg:grid-cols-2">
        <BriefSection no={4} title="What is at risk">
          <AtRisk graph={graph} />
        </BriefSection>
        <BriefSection no={5} title="What remains safe">
          <RemainsSafe graph={graph} />
        </BriefSection>
      </div>

      <BriefSection
        no={6}
        title="Recommended alternatives"
        aside={
          criterion
            ? `Ranked on ${criterion}`
            : "Seeded order — no scoring policy behind this alert"
        }
      >
        <AlternativesSection graph={graph} />
      </BriefSection>

      <BriefSection no={7} title="Decision requested">
        <DecisionRequested alert={alert} graph={graph} exposure={exposure} />
      </BriefSection>

      <div className="grid gap-5 lg:grid-cols-2">
        <BriefSection no={8} title="Key assumptions and gaps">
          <AssumptionsSection alert={alert} graph={graph} exposure={exposure} />
        </BriefSection>
        <BriefSection no={9} title="Next update">
          <NextUpdate alert={alert} graph={graph} />
        </BriefSection>
      </div>

      <p className="border-t-2 border-surface-2 pt-3 font-mono text-[9.5px] leading-relaxed text-text-tertiary">
        {basisLine(alert, graph, exposure)}
      </p>
    </>
  );
}

// Client shell for the Brief page: resolves the alert from `?alert=`, fetches
// the same live graph and exposure the Monitor console would, and lays the
// result out as a memo. Selection state does not cross routes, so the id in
// the URL is the whole contract — which is also what makes a brief shareable.
export default function BriefConsole() {
  const requestedId = useSearchParams().get("alert");
  const alerts = useMemo(() => sortBySeverity(ALERTS), []);
  // No id means the reader came through the nav rail: brief the top of the
  // queue, exactly what the Monitor console selects on load.
  const alert = requestedId
    ? ALERTS.find((a) => a.id === requestedId)
    : alerts[0];
  const mineId = alert?.mineId;

  // Keyed by mine id, MonitorConsole's pattern: a result for another selection
  // reads as "still loading" rather than briefly showing the wrong graph.
  const [graphRes, setGraphRes] = useState<{
    readonly mineId: string;
    readonly graph?: AlertGraph;
    readonly state: LoadState;
  }>();
  const [expoRes, setExpoRes] = useState<{
    readonly mineId: string;
    readonly exposure?: MineExposure;
    readonly state: LoadState;
  }>();

  useEffect(() => {
    if (!mineId) return;
    const controller = new AbortController();
    (async () => {
      let res = await fetchDisruption(mineId, { signal: controller.signal });
      // The console floors the impact year at the mine's own production start
      // via the mines list; here the first response carries the same facts, so
      // a mine not yet producing is re-struck at its start year directly.
      if (
        res.before_production_start &&
        res.earliest_year != null &&
        res.earliest_year > res.as_of_year
      ) {
        res = await fetchDisruption(mineId, {
          asOfYear: res.earliest_year,
          signal: controller.signal,
        });
      }
      setGraphRes({ mineId, graph: toAlertGraph(res), state: "idle" });
    })().catch((err: unknown) => {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setGraphRes({ mineId, state: "error" });
    });
    return () => controller.abort();
  }, [mineId]);

  useEffect(() => {
    if (!mineId) return;
    const controller = new AbortController();
    fetchExposure(mineId, { signal: controller.signal })
      .then((exposure) => setExpoRes({ mineId, exposure, state: "idle" }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // The graph can still carry the brief; §3 says the exposure is missing.
        setExpoRes({ mineId, state: "error" });
      });
    return () => controller.abort();
  }, [mineId]);

  const currentGraph =
    mineId && graphRes?.mineId === mineId ? graphRes : undefined;
  const currentExpo = mineId && expoRes?.mineId === mineId ? expoRes : undefined;
  const graphState: LoadState = !mineId
    ? "idle"
    : (currentGraph?.state ?? "loading");
  const exposureState: LoadState = !mineId
    ? "idle"
    : (currentExpo?.state ?? "loading");
  const graph = alert
    ? mineId
      ? currentGraph?.graph
      : graphForAlert(alert.id)
    : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BriefHeader alert={alert} watchName={WATCH_NAME} />
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <article className="blueprint flex min-h-full w-full flex-col gap-5 p-6">
          {!alert ? (
            <div className="flex flex-col gap-3">
              <p className="text-xs leading-relaxed text-text-secondary">
                No alert with id{" "}
                <span className="font-mono text-accent">{requestedId}</span> is
                on the queue, so there is nothing to brief.
              </p>
              <Link
                href="/monitor"
                className="font-mono text-[11px] tracking-[0.15em] text-accent uppercase underline decoration-surface-2 underline-offset-2 hover:decoration-accent"
              >
                Pick an alert on the monitor
              </Link>
            </div>
          ) : (
            <>
              <MemoHeader alert={alert} watchName={WATCH_NAME} />
              {mineId && graphState === "loading" ? (
                <BriefNotice>
                  Simulating disruption — assembling the brief…
                </BriefNotice>
              ) : mineId && graphState === "error" ? (
                <BriefNotice>
                  Could not reach the disruption API, and a brief assembled
                  without the live graph would misstate the exposure. Retry
                  once the API is reachable.
                </BriefNotice>
              ) : (
                <BriefBody
                  alert={alert}
                  graph={graph}
                  exposure={currentExpo?.exposure}
                  exposureState={exposureState}
                />
              )}
            </>
          )}
        </article>
      </div>
    </div>
  );
}
