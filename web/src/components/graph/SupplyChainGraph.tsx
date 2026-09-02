"use client";

import "@xyflow/react/dist/style.css";
import { useEffect, useState } from "react";
import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@xyflow/react";
import type { GraphData, GraphEdge, GraphNode } from "@/lib/api/types";
import { toFlow } from "@/lib/graph/toFlow";
import { layoutWithElk } from "@/lib/graph/layout";
import { EntityNode } from "@/components/graph/nodes/EntityNode";
import { UnresolvedNode } from "@/components/graph/nodes/UnresolvedNode";
import { StatusEdge } from "@/components/graph/edges/StatusEdge";
import { Legend } from "@/components/graph/Legend";

const nodeTypes = { entity: EntityNode, unresolved: UnresolvedNode };
const edgeTypes = { status: StatusEdge };

interface SupplyChainGraphProps {
  graph: GraphData;
  onSelectNode?: (node: GraphNode) => void;
  onSelectEdge?: (edge: GraphEdge) => void;
  onClearSelection?: () => void;
}

export function SupplyChainGraph({
  graph,
  onSelectNode,
  onSelectEdge,
  onClearSelection,
}: SupplyChainGraphProps) {
  const [showAlternatives, setShowAlternatives] = useState(true);
  // Controlled flow WITH change handlers, so selection (and dragging)
  // actually applies — a controlled ReactFlow without them discards all
  // changes silently.
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [laidOut, setLaidOut] = useState(false);
  const alternativeCount = graph.edges.filter((edge) => edge.type === "ALTERNATIVE_TO").length;

  useEffect(() => {
    let cancelled = false;
    const { nodes: rawNodes, edges: nextEdges } = toFlow(graph, {
      includeAlternatives: showAlternatives,
    });
    layoutWithElk(rawNodes, nextEdges)
      .then((positioned) => {
        if (cancelled) return;
        setNodes(positioned);
        setEdges(nextEdges);
        setLaidOut(true);
      })
      .catch(() => {
        // Layout failure should not blank the page; fall back to unpositioned.
        if (cancelled) return;
        setNodes(rawNodes);
        setEdges(nextEdges);
        setLaidOut(true);
      });
    return () => {
      cancelled = true;
    };
  }, [graph, showAlternatives, setNodes, setEdges]);

  if (!laidOut) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Laying out graph…</p>
      </div>
    );
  }
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      nodesConnectable={false}
      minZoom={0.2}
      onNodeClick={(_, node) => {
        const graphNode = node.data.graphNode as GraphNode | undefined;
        if (graphNode) {
          onSelectNode?.(graphNode);
          return;
        }
        // A placeholder "?" node stands for its unresolved edge.
        const unresolvedEdgeId = node.data.unresolvedEdgeId as string | undefined;
        const unresolvedEdge = graph.edges.find((edge) => edge.id === unresolvedEdgeId);
        if (unresolvedEdge) onSelectEdge?.(unresolvedEdge);
      }}
      onEdgeClick={(_, edge) => {
        const graphEdge = edge.data?.edge as GraphEdge | undefined;
        if (graphEdge) onSelectEdge?.(graphEdge);
      }}
      onPaneClick={() => onClearSelection?.()}
    >
      <Background />
      <Controls showInteractive={false} />
      <Panel position="top-left">
        <Legend />
      </Panel>
      <Panel position="top-right">
        <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-200 bg-white/90 px-2 py-1 text-xs text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={showAlternatives}
            onChange={(event) => setShowAlternatives(event.target.checked)}
          />
          Show alternatives ({alternativeCount})
        </label>
      </Panel>
    </ReactFlow>
  );
}
