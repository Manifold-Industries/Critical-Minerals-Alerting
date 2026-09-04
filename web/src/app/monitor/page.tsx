import type { Metadata } from "next";
import MonitorHeader from "@/components/monitor/MonitorHeader";
import MonitorConsole from "@/components/monitor/MonitorConsole";
import { ALERTS, WATCH_NAME } from "@/lib/monitor/alerts";

export const metadata: Metadata = {
  title: "Strategic Alerts",
};

export default function MonitorPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MonitorHeader watchName={WATCH_NAME} alertCount={ALERTS.length} />
      <MonitorConsole />
    </div>
  );
}
