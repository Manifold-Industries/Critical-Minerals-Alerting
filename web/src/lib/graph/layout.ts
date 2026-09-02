/**
 * Async ELK layered layout, left-to-right in supply-chain stage order.
 *
 * Uses the bundled (non-worker) ELK build to avoid worker bundling under
 * Next/Turbopack. Pure in/out: returns a new node array with positions.
 */
import ELK from "elkjs/lib/elk.bundled.js";
import type { Edge, Node } from "@xyflow/react";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 48;

/** Column per kind; organizations are left free for ELK to place. */
const STAGE_PARTITION: Record<string, number> = {
  deposit: 0,
  project: 1,
  facility: 2,
  material: 3,
  component: 4,
  system: 5,
};

const LAST_PARTITION = Math.max(...Object.values(STAGE_PARTITION));

const LAYOUT_OPTIONS: Record<string, string> = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.partitioning.activate": "true",
  "elk.layered.spacing.nodeNodeBetweenLayers": "96",
  "elk.spacing.nodeNode": "32",
};

export async function layoutWithElk(nodes: readonly Node[], edges: readonly Edge[]): Promise<Node[]> {
  const elk = new ELK();
  const result = await elk.layout({
    id: "root",
    layoutOptions: LAYOUT_OPTIONS,
    children: nodes.map((node) => ({
      id: node.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      layoutOptions: elkOptionsFor(node, nodes, edges),
    })),
    edges: edges.map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
  });

  const positions = new Map(
    (result.children ?? []).map((child) => [child.id, { x: child.x ?? 0, y: child.y ?? 0 }]),
  );
  return nodes.map((node) => ({ ...node, position: positions.get(node.id) ?? node.position }));
}

function elkOptionsFor(node: Node, nodes: readonly Node[], edges: readonly Edge[]): Record<string, string> {
  const partition = partitionFor(node, nodes, edges);
  return partition === undefined ? {} : { "elk.partitioning.partition": String(partition) };
}

function partitionFor(node: Node, nodes: readonly Node[], edges: readonly Edge[]): number | undefined {
  const kind = kindOf(node);
  if (kind !== "unresolved") return STAGE_PARTITION[kind];

  // Place an unresolved placeholder one stage downstream of its source so
  // the dangling edge points forward like every other flow.
  const incoming = edges.find((edge) => edge.target === node.id);
  const source = incoming ? nodes.find((candidate) => candidate.id === incoming.source) : undefined;
  const sourcePartition = source ? STAGE_PARTITION[kindOf(source)] : undefined;
  return sourcePartition === undefined ? undefined : Math.min(sourcePartition + 1, LAST_PARTITION);
}

function kindOf(node: Node): string {
  return typeof node.data.kind === "string" ? node.data.kind : "";
}
