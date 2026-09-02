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

export interface ToFlowOptions {
  includeAlternatives?: boolean;
}

export function toFlow(graph: GraphData, options: ToFlowOptions = {}): FlowGraph {
  const includeAlternatives = options.includeAlternatives ?? true;
  const edges = includeAlternatives
    ? graph.edges
    : graph.edges.filter((edge) => edge.type !== "ALTERNATIVE_TO");
  return {
    nodes: toFlowNodes(graph.nodes, edges),
    edges: toFlowEdges(edges, materialNamesById(graph.nodes)),
  };
}

export function toFlowNodes(nodes: readonly GraphNode[], edges: readonly GraphEdge[]): Node[] {
  const connectedIds = new Set(
    edges.flatMap((edge) => (edge.to_id === null ? [edge.from_id] : [edge.from_id, edge.to_id])),
  );
  const visible = nodes.filter((node) => node.kind !== "material" || connectedIds.has(node.id));
  const entityNodes = visible.map(entityNode);
  const placeholders = edges.filter((edge) => edge.to_id === null).map(placeholderNode);
  return [...entityNodes, ...placeholders];
}

export function toFlowEdges(edges: readonly GraphEdge[], materialNames: ReadonlyMap<string, string>): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.from_id,
    target: edge.to_id ?? `${UNRESOLVED_TARGET_PREFIX}${edge.id}`,
    type: "status",
    data: { edge, label: edgeLabel(edge, materialNames) },
  }));
}

function materialNamesById(nodes: readonly GraphNode[]): Map<string, string> {
  return new Map(nodes.filter((node) => node.kind === "material").map((node) => [node.id, node.name]));
}

function edgeLabel(edge: GraphEdge, materialNames: ReadonlyMap<string, string>): string | null {
  if (edge.type !== "SUPPLIES" || edge.material_ids.length === 0) return null;
  return edge.material_ids.map((id) => materialNames.get(id) ?? id).join(" · ");
}

function entityNode(node: GraphNode): Node {
  return {
    id: node.id,
    type: "entity",
    position: { x: 0, y: 0 },
    data: { kind: node.kind, graphNode: node },
  };
}

function placeholderNode(edge: GraphEdge): Node {
  return {
    id: `${UNRESOLVED_TARGET_PREFIX}${edge.id}`,
    type: "unresolved",
    position: { x: 0, y: 0 },
    data: { kind: "unresolved", unresolvedEdgeId: edge.id },
  };
}
