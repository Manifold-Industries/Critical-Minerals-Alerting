"use client";

import { useState } from "react";
import { useGraph } from "@/lib/api/useGraph";
import { ErrorState } from "@/components/ui/ErrorState";
import { SupplyChainGraph } from "@/components/graph/SupplyChainGraph";
import { EntityPanel, type Selection } from "@/components/entity/EntityPanel";

export default function FlowPage() {
  const { state, retry } = useGraph();
  const [selection, setSelection] = useState<Selection | null>(null);

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
          onSelectNode={(node) => setSelection({ kind: "node", node })}
          onSelectEdge={(edge) => setSelection({ kind: "edge", edge })}
          onClearSelection={() => setSelection(null)}
        />
      </div>
      {selection && (
        <EntityPanel selection={selection} graph={state.graph} onClose={() => setSelection(null)} />
      )}
    </main>
  );
}
