"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ALERTS, sortBySeverity, type Alert } from "@/lib/monitor/alerts";
import {
  DEFAULT_IMPACT_YEAR,
  fetchDisruption,
  fetchExposure,
  fetchMines,
  toAlertGraph,
  toContextAsset,
  type MineExposure,
} from "@/lib/monitor/api";
import type { AlertGraph, GeoNode } from "@/lib/monitor/graphs";
import AlertQueue from "./AlertQueue";
import DecisionPanel from "./DecisionPanel";
import GlobePanel from "./GlobePanel";

type LoadState = "idle" | "loading" | "error";

// Mines to resolve end uses for. ALERTS is a module constant, so this is known
// before the first render and the initial exposure state can be derived from it
// rather than corrected by an effect.
const MINE_IDS = [
  ...new Set(ALERTS.map((alert) => alert.mineId).filter((id) => id !== undefined)),
];

// Client shell for the three-column console: owns which alert and which map
// node are selected so the globe and decision panel follow the queue.
//
// Alerts carrying a `mineId` have their graph simulated on demand rather than
// read from a fixture, so what the panel shows tracks the supply graph. The
// rest still render from `graphs.ts`. Only one alert is in view at a time, so
// this fetches per selection with an inline loading state — no cache to share
// and nothing to revalidate, which is what a data-fetching library would buy.
export default function MonitorConsole() {
  const alerts = useMemo(() => sortBySeverity(ALERTS), []);
  const [selectedId, setSelectedId] = useState(alerts[0]?.id ?? "");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  // Keyed by the mine it belongs to, so a result can never outlive its alert:
  // anything whose key does not match the current selection is simply ignored,
  // which is why no effect has to reset it.
  const [result, setResult] = useState<{
    readonly mineId: string;
    readonly year: number;
    readonly graph?: AlertGraph;
    readonly state: LoadState;
  }>();
  const [contextAssets, setContextAssets] = useState<Record<string, GeoNode>>({});
  // Which end uses each mine's Dy/Tb reaches, keyed by mine id. Fetched once
  // rather than per selection: the queue shows it for every mine-backed alert
  // at the same time, and nothing in the end-use layer is staged by year, so
  // there is no parameter for a result to go stale against.
  const [exposures, setExposures] = useState<Record<string, MineExposure>>({});
  const [exposureState, setExposureState] = useState<LoadState>(
    MINE_IDS.length === 0 ? "idle" : "loading",
  );
  const [earliestByMine, setEarliestByMine] = useState<Record<string, number | null>>({});

  const selectedAlert: Alert | undefined =
    alerts.find((alert) => alert.id === selectedId) ?? alerts[0];
  const mineId = selectedAlert?.mineId;

  // Every simulation is struck at the default year. The mine's own expected
  // production start is still a floor on it: Caldeira does not open until after
  // it, and simulating a mine before it produces disrupts output the graph does
  // not say exists yet. No ceiling is needed — the band's upper end is the
  // latest year any record mentions, so no start year can sit above it.
  const earliest = mineId ? (earliestByMine[mineId] ?? null) : null;
  const asOfYear = Math.max(DEFAULT_IMPACT_YEAR, earliest ?? DEFAULT_IMPACT_YEAR);

  // Context-mode markers for live alerts, which have no fixture graph to read
  // an asset position from. One request, on mount.
  useEffect(() => {
    const controller = new AbortController();
    fetchMines({ signal: controller.signal })
      .then((mines) => {
        const byMineId = new Map(mines.map((m) => [m.mine_id, m]));
        const next: Record<string, GeoNode> = {};
        for (const alert of ALERTS) {
          const mine = alert.mineId ? byMineId.get(alert.mineId) : undefined;
          const asset = mine ? toContextAsset(mine) : undefined;
          if (asset) next[alert.id] = asset;
        }
        setContextAssets(next);
        setEarliestByMine(
          Object.fromEntries(mines.map((m) => [m.mine_id, m.earliest_year])),
        );
      })
      .catch(() => {
        // Context markers are decoration; losing them must not break the console.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (MINE_IDS.length === 0) return;
    const controller = new AbortController();
    // allSettled, not all: one unreachable mine must not blank the affected
    // systems on every other alert in the queue.
    Promise.allSettled(
      MINE_IDS.map((id) => fetchExposure(id, { signal: controller.signal })),
    ).then((settled) => {
      if (controller.signal.aborted) return;
      const ok = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      setExposures(Object.fromEntries(ok.map((e) => [e.mine_id, e])));
      setExposureState(ok.length === 0 ? "error" : "idle");
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!mineId) return;
    const controller = new AbortController();
    fetchDisruption(mineId, { asOfYear, signal: controller.signal })
      .then((res) =>
        setResult({ mineId, year: asOfYear, graph: toAlertGraph(res), state: "idle" }),
      )
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResult({ mineId, year: asOfYear, state: "error" });
      });
    return () => controller.abort();
  }, [mineId, asOfYear]);

  const selectAlert = useCallback((id: string) => {
    setSelectedId(id);
    setSelectedNodeId(null);
  }, []);

  if (!selectedAlert) return null;

  // Derived, not stored: a result for a different mine reads as "still loading"
  // rather than briefly showing the previous alert's graph.
  const current =
    mineId && result?.mineId === mineId && result.year === asOfYear
      ? result
      : undefined;
  const graph = current?.graph;
  const loadState: LoadState = !mineId ? "idle" : (current?.state ?? "loading");

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(220px,320px)_minmax(280px,1fr)_minmax(280px,400px)] gap-3 p-3">
      <AlertQueue
        alerts={alerts}
        exposures={exposures}
        exposureState={exposureState}
        selectedId={selectedId}
        onSelect={selectAlert}
      />
      <GlobePanel
        alerts={alerts}
        selectedAlert={selectedAlert}
        liveGraph={graph}
        contextAssets={contextAssets}
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
        onSelectAlert={selectAlert}
        onClearNode={() => setSelectedNodeId(null)}
      />
      <DecisionPanel
        alert={selectedAlert}
        liveGraph={graph}
        exposure={mineId ? exposures[mineId] : undefined}
        exposureState={mineId ? exposureState : "idle"}
        loadState={loadState}
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
      />
    </div>
  );
}
