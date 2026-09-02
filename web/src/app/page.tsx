"use client";

import { useGraph } from "@/lib/api/useGraph";
import { ErrorState } from "@/components/ui/ErrorState";
import { SupplyChainGraph } from "@/components/graph/SupplyChainGraph";

export default function FlowPage() {
  const { state, retry } = useGraph();

  if (state.status === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading supply-chain graph…</p>
      </main>
    );
  }
  if (state.status === "error") {
    return (
      <main className="flex flex-1">
        <ErrorState message={state.message} onRetry={retry} />
      </main>
    );
  }
  return (
    <main className="h-dvh w-full">
      <SupplyChainGraph graph={state.graph} />
    </main>
  );
}
