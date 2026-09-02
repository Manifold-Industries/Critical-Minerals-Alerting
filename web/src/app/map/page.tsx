"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { GraphNode } from "@/lib/api/types";
import { useGraph } from "@/lib/api/useGraph";
import { locatedAssets, unlocatedAssets } from "@/lib/map/markers";
import { ErrorState } from "@/components/ui/ErrorState";
import { EntityPanel, type Selection } from "@/components/entity/EntityPanel";
import { UnlocatedNotice } from "@/components/map/UnlocatedNotice";

// Leaflet touches window at import time — client-only, no prerender.
const AssetMap = dynamic(() => import("@/components/map/AssetMap").then((m) => m.AssetMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading map…</p>
    </div>
  ),
});

export default function MapPage() {
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

  const located = locatedAssets(state.graph);
  const unlocated = unlocatedAssets(state.graph);
  const select = (node: GraphNode) => setSelection({ kind: "node", node });

  return (
    <main className="flex h-dvh w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <AssetMap assets={located} onSelect={select} />
        </div>
        <UnlocatedNotice unlocated={unlocated} total={located.length + unlocated.length} />
      </div>
      {selection && (
        <EntityPanel selection={selection} graph={state.graph} onClose={() => setSelection(null)} />
      )}
    </main>
  );
}
