"use client";

import { useSyncExternalStore } from "react";

// Zulu (UTC) timestamp in DoD date-time-group style, e.g. "201430Z AUG 2026".
function formatZulu(now: Date): string {
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hours = String(now.getUTCHours()).padStart(2, "0");
  const minutes = String(now.getUTCMinutes()).padStart(2, "0");
  const month = now
    .toLocaleString("en-US", { month: "short", timeZone: "UTC" })
    .toUpperCase();
  const year = now.getUTCFullYear();
  return `${day}${hours}${minutes}Z ${month} ${year}`;
}

function subscribeToClock(onStoreChange: () => void): () => void {
  const interval = setInterval(onStoreChange, 1000);
  return () => clearInterval(interval);
}

// Terminal-style identity strip: mission ownership on the left, a live Zulu
// clock on the right. The server snapshot is null so server and client
// hydration markup agree; the live time fills in on the client.
export default function CommandHeader() {
  const zulu = useSyncExternalStore(
    subscribeToClock,
    () => formatZulu(new Date()),
    () => null,
  );

  return (
    <header className="flex items-center justify-between border-b border-surface-2 bg-surface-1 px-4 py-1.5 font-mono text-[10px] tracking-[0.2em] text-text-secondary">
      <p className="uppercase">
        <span className="font-semibold text-accent">Critical Minerals</span>
        <span className="mx-2 text-text-tertiary">·</span>
        <span className="text-foreground">Supply Chain Monitoring</span>
      </p>
      <p className="uppercase text-text-tertiary">
        Disruption Alerting Console
        <span className="mx-2">·</span>
        <span className="tabular-nums text-positive">{zulu ?? "——————Z"}</span>
      </p>
    </header>
  );
}
