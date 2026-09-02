"use client";

import "@xyflow/react/dist/style.css";
import { useEffect, useState } from "react";
import { Background, Controls, ReactFlow } from "@xyflow/react";
import type { GraphData } from "@/lib/api/types";
import { toFlow, type FlowGraph } from "@/lib/graph/toFlow";
import { layoutWithElk } from "@/lib/graph/layout";

interface SupplyChainGraphProps {
  graph: GraphData;
}

export function SupplyChainGraph({ graph }: SupplyChainGraphProps) {
  const [flow, setFlow] = useState<FlowGraph | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { nodes, edges } = toFlow(graph);
    layoutWithElk(nodes, edges)
      .then((positioned) => {
        if (!cancelled) setFlow({ nodes: positioned, edges });
      })
      .catch(() => {
        // Layout failure should not blank the page; fall back to unpositioned.
        if (!cancelled) setFlow({ nodes, edges });
      });
    return () => {
      cancelled = true;
    };
  }, [graph]);

  if (flow === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Laying out graph…</p>
      </div>
    );
  }
  return (
    <ReactFlow
      nodes={flow.nodes}
      edges={flow.edges}
      fitView
      nodesConnectable={false}
      edgesFocusable={true}
      minZoom={0.2}
    >
      <Background />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
