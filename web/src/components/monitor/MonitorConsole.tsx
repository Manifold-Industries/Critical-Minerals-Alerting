"use client";

import { useCallback, useMemo, useState } from "react";
import { ALERTS, sortBySeverity } from "@/lib/monitor/alerts";
import AlertQueue from "./AlertQueue";
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
      {/* FOR CHRIS TO IMPLEMENT — planned sections: title block w/ tags,
          "What happened", affected-systems rows (click → highlight globe
          node), ranked alternatives. */}
      <section className="blueprint flex min-h-0 flex-col items-center justify-center gap-2 p-4">
        <h2 className="font-mono text-xs font-semibold tracking-[0.2em] text-text-secondary uppercase">
          Decision panel
        </h2>
        <p className="font-mono text-[10px] tracking-[0.15em] text-accent uppercase">
          For Chris to implement
        </p>
        <p className="max-w-[240px] text-center font-mono text-[10px] leading-relaxed tracking-[0.1em] text-text-tertiary uppercase">
          Title block · what happened · affected systems · ranked alternatives
        </p>
      </section>
    </div>
  );
}
