"use client";

import { useGraph } from "@/lib/api/useGraph";
import { ErrorState } from "@/components/ui/ErrorState";

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
    <main className="flex flex-1 items-center justify-center">
      <p className="text-lg text-zinc-800 dark:text-zinc-200">
        {state.graph.nodes.length} nodes · {state.graph.edges.length} edges
      </p>
    </main>
  );
}
