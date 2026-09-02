"use client";

import { useCallback, useMemo, useState } from "react";
import { ALERTS, sortBySeverity } from "@/lib/monitor/alerts";
import AlertQueue from "./AlertQueue";
import DecisionPanel from "./DecisionPanel";
import GlobePanel from "./GlobePanel";

// Client shell for the three-column console: owns which alert and which map
// node are selected so the globe and decision panel follow the queue.
export default function MonitorConsole() {
  const alerts = useMemo(() => sortBySeverity(ALERTS), []);
  const [selectedId, setSelectedId] = useState(alerts[0]?.id ?? "");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedAlert =
    alerts.find((alert) => alert.id === selectedId) ?? alerts[0];

  const selectAlert = useCallback((id: string) => {
    setSelectedId(id);
    setSelectedNodeId(null);
  }, []);

  if (!selectedAlert) return null;

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
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
        onSelectAlert={selectAlert}
      />
      <DecisionPanel
        alert={selectedAlert}
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
      />
    </div>
  );
}
