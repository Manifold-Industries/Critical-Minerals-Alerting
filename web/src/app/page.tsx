"use client";

import { useState } from "react";
import type { GraphNode } from "@/lib/api/types";
import { useGraph } from "@/lib/api/useGraph";
import { ErrorState } from "@/components/ui/ErrorState";
import { SupplyChainGraph } from "@/components/graph/SupplyChainGraph";
import { EntityPanel } from "@/components/entity/EntityPanel";

export default function FlowPage() {
  const { state, retry } = useGraph();
  const [selected, setSelected] = useState<GraphNode | null>(null);

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
    <main className="flex h-dvh w-full">
      <div className="min-w-0 flex-1">
        <SupplyChainGraph
          graph={state.graph}
          onSelectNode={setSelected}
          onClearSelection={() => setSelected(null)}
        />
      </div>
      {selected && (
        <EntityPanel node={selected} graph={state.graph} onClose={() => setSelected(null)} />
      )}
    </main>
  );
}
