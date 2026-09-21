import { useEffect, useState } from "react";

import type { Alert } from "./alerts";
import {
  fetchDisruption,
  fetchExposure,
  toAlertGraph,
  type MineExposure,
} from "./api";
import { graphForAlert, type AlertGraph } from "./graphs";
import {
  ALTERNATIVES_SHOWN,
  rankCandidates,
  type FactorWeights,
} from "./ranking";

export type BriefLoadState = "idle" | "loading" | "error";

export interface BriefData {
  readonly graph?: AlertGraph;
  readonly graphState: BriefLoadState;
  readonly exposure?: MineExposure;
  readonly exposureState: BriefLoadState;
}

/**
 * Simulate at `year`, stepping forward once if the mine is not producing yet.
 *
 * A link from the console always carries the year the console simulated at. A
 * link without one - the brief index, a hand-typed URL - starts at the default,
 * and for a mine that opens later that disrupts output the graph does not say
 * exists. The response names the mine's first year, so the correction costs one
 * more request rather than a second endpoint.
 */
async function simulate(
  mineId: string,
  year: number | undefined,
  signal: AbortSignal,
): Promise<AlertGraph | undefined> {
  const first = await fetchDisruption(mineId, { asOfYear: year, signal });
  if (!first.before_production_start || first.earliest_year == null) {
    return toAlertGraph(first);
  }
  return toAlertGraph(
    await fetchDisruption(mineId, { asOfYear: first.earliest_year, signal }),
  );
}

/**
 * Everything a decision brief is assembled from, for one alert.
 *
 * The same two requests the console makes, and they are kept as apart here as
 * they are there: a brief with no end-use layer is still a brief, and has to
 * say that layer is missing rather than fail whole. `weights` re-ranks the
 * candidate pool exactly as the rail does; null leaves the engine's default
 * alignment-only order in place.
 */
export function useBriefData(
  alert: Alert,
  year: number | undefined,
  weights: FactorWeights | null,
): BriefData {
  const mineId = alert.mineId;
  const [fetched, setFetched] = useState<{
    readonly graph?: AlertGraph;
    readonly state: BriefLoadState;
  }>({ state: mineId ? "loading" : "idle" });
  const [exposure, setExposure] = useState<{
    readonly value?: MineExposure;
    readonly state: BriefLoadState;
  }>({ state: mineId ? "loading" : "idle" });

  useEffect(() => {
    if (!mineId) return;
    const controller = new AbortController();
    const { signal } = controller;
    simulate(mineId, year, signal)
      .then((graph) => setFetched({ graph, state: "idle" }))
      .catch(() => {
        if (!signal.aborted) setFetched({ state: "error" });
      });
    fetchExposure(mineId, { signal })
      .then((value) => setExposure({ value, state: "idle" }))
      .catch(() => {
        if (!signal.aborted) setExposure({ state: "error" });
      });
    return () => controller.abort();
  }, [mineId, year]);

  // A fixture alert has no engine behind it; its graph is the seeded one.
  const base = mineId ? fetched.graph : graphForAlert(alert.id);
  const graph =
    base?.candidates && weights
      ? {
          ...base,
          alternatives: rankCandidates(base.candidates, weights, ALTERNATIVES_SHOWN),
        }
      : base;

  return {
    graph,
    graphState: fetched.state,
    exposure: exposure.value,
    exposureState: exposure.state,
  };
}
