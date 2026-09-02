import type { Metadata } from "next";
import MonitorHeader from "@/components/monitor/MonitorHeader";

export const metadata: Metadata = {
  title: "Strategic Alerts",
};

// Placeholder feed stats until the alert data model lands with the queue.
const WATCH_NAME = "Critical minerals watch";
const ALERT_COUNT = 6;

// Column placeholders, replaced one by one as each rail/panel is built.
const PANELS = [
  { name: "Alert queue", hint: "Ranked by strategic consequence" },
  { name: "Map", hint: "Impact / alternatives / context" },
  { name: "Decision panel", hint: "Assessment and recommendations" },
] as const;

export default function MonitorPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MonitorHeader watchName={WATCH_NAME} alertCount={ALERT_COUNT} />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(220px,320px)_minmax(280px,1fr)_minmax(280px,400px)] gap-3 p-3">
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
    </div>
  );
}
