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

/** Column per kind; organizations and placeholders are left free for ELK. */
const STAGE_PARTITION: Record<string, number> = {
  deposit: 0,
  project: 1,
  facility: 2,
  material: 3,
  component: 4,
  system: 5,
};

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
      layoutOptions: partitionFor(node),
    })),
    edges: edges.map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
  });

  const positions = new Map(
    (result.children ?? []).map((child) => [child.id, { x: child.x ?? 0, y: child.y ?? 0 }]),
  );
  return nodes.map((node) => ({ ...node, position: positions.get(node.id) ?? node.position }));
}

function partitionFor(node: Node): Record<string, string> {
  const kind = typeof node.data.kind === "string" ? node.data.kind : "";
  const partition = STAGE_PARTITION[kind];
  return partition === undefined ? {} : { "elk.partitioning.partition": String(partition) };
}
