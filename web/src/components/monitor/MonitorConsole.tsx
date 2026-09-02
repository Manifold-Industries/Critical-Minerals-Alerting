"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ALERTS, sortBySeverity, type Alert } from "@/lib/monitor/alerts";
import {
  fetchDisruption,
  fetchMines,
  toAlertGraph,
  toContextAsset,
} from "@/lib/monitor/api";
import type { AlertGraph, GeoNode } from "@/lib/monitor/graphs";
import AlertQueue from "./AlertQueue";
import DecisionPanel from "./DecisionPanel";
import GlobePanel from "./GlobePanel";

type LoadState = "idle" | "loading" | "error";

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
    readonly graph?: AlertGraph;
    readonly state: LoadState;
  }>();
  const [contextAssets, setContextAssets] = useState<Record<string, GeoNode>>({});

  const selectedAlert: Alert | undefined =
    alerts.find((alert) => alert.id === selectedId) ?? alerts[0];
  const mineId = selectedAlert?.mineId;


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
      })
      .catch(() => {
        // Context markers are decoration; losing them must not break the console.
      });
    return () => controller.abort();
  }, []);


  useEffect(() => {
    if (!mineId) return;
    const controller = new AbortController();
    fetchDisruption(mineId, { signal: controller.signal })
      .then((res) =>
        setResult({ mineId, graph: toAlertGraph(res), state: "idle" }),
      )
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResult({ mineId, state: "error" });
      });
    return () => controller.abort();
  }, [mineId]);

  const selectAlert = useCallback((id: string) => {
    setSelectedId(id);
    setSelectedNodeId(null);
  }, []);

  if (!selectedAlert) return null;

  // Derived, not stored: a result for a different mine reads as "still loading"
  // rather than briefly showing the previous alert's graph.
  const current = mineId && result?.mineId === mineId ? result : undefined;
  const graph = current?.graph;
  const loadState: LoadState = !mineId ? "idle" : (current?.state ?? "loading");

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(220px,320px)_minmax(280px,1fr)_minmax(280px,400px)] gap-3 p-3">
      <AlertQueue
        alerts={alerts}
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
        loadState={loadState}
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
      />
    </div>
  );
}
