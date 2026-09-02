"use client";

import { useMemo, useState } from "react";
import { ALERTS, sortBySeverity } from "@/lib/monitor/alerts";
import AlertQueue from "./AlertQueue";

// Column placeholders, replaced one by one as each panel is built.
const PANELS = [
  { name: "Map", hint: "Impact / alternatives / context" },
  { name: "Decision panel", hint: "Assessment and recommendations" },
] as const;

// Client shell for the three-column console: owns which alert is selected so
// the map and decision panel can follow the queue.
export default function MonitorConsole() {
  const alerts = useMemo(() => sortBySeverity(ALERTS), []);
  const [selectedId, setSelectedId] = useState(alerts[0]?.id ?? "");

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(220px,320px)_minmax(280px,1fr)_minmax(280px,400px)] gap-3 p-3">
      <AlertQueue
        alerts={alerts}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      {PANELS.map((panel) => (
        <section
          key={panel.name}
          className="blueprint flex min-h-0 flex-col items-center justify-center gap-2 p-4"
        >
          <h2 className="font-mono text-xs font-semibold tracking-[0.2em] text-text-secondary uppercase">
            {panel.name}
          </h2>
          <p className="font-mono text-[10px] tracking-[0.15em] text-text-tertiary uppercase">
            {panel.hint}
          </p>
        </section>
      ))}
    </div>
  );
}
