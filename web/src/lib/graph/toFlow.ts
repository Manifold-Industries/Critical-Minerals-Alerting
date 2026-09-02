/**
 * Pure transform: API GraphData -> React Flow nodes/edges (unpositioned).
 *
 * Material nodes with no incident edge are hidden (SPEC decision 3) — they
 * appear only as labels on SUPPLIES edges. UNRESOLVED edges (to_id null)
 * get a synthetic placeholder target node so the dangling dependency is
 * visible rather than missing.
 */
import type { Edge, Node } from "@xyflow/react";
import type { GraphData, GraphEdge, GraphNode } from "@/lib/api/types";

export const UNRESOLVED_TARGET_PREFIX = "unresolved:";

export interface FlowGraph {
  nodes: Node[];
  edges: Edge[];
}

export function toFlow(graph: GraphData): FlowGraph {
  return { nodes: toFlowNodes(graph), edges: toFlowEdges(graph.edges) };
}

export function toFlowNodes(graph: GraphData): Node[] {
  const connectedIds = new Set(
    graph.edges.flatMap((edge) => (edge.to_id === null ? [edge.from_id] : [edge.from_id, edge.to_id])),
  );
  const visible = graph.nodes.filter((node) => node.kind !== "material" || connectedIds.has(node.id));
  const entityNodes = visible.map(entityNode);
  const placeholders = graph.edges.filter((edge) => edge.to_id === null).map(placeholderNode);
  return [...entityNodes, ...placeholders];
}

export function toFlowEdges(edges: readonly GraphEdge[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.from_id,
    target: edge.to_id ?? `${UNRESOLVED_TARGET_PREFIX}${edge.id}`,
    data: { edge },
  }));
}

function entityNode(node: GraphNode): Node {
  return {
    id: node.id,
    position: { x: 0, y: 0 },
    data: { label: node.name, kind: node.kind, graphNode: node },
  };
}

function placeholderNode(edge: GraphEdge): Node {
  return {
    id: `${UNRESOLVED_TARGET_PREFIX}${edge.id}`,
    position: { x: 0, y: 0 },
    data: { label: "?", kind: "unresolved", unresolvedEdgeId: edge.id },
  };
}
