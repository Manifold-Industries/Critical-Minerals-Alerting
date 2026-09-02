/**
 * Pure selectors for the Geography view: which assets have attested
 * coordinates (mappable) and which do not (listed, never guessed).
 */
import type { GraphData, GraphNode, Provenance } from "@/lib/api/types";

export interface LocatedAsset {
  node: GraphNode;
  latitude: number;
  longitude: number;
  provenance: Provenance;
}

const MAPPABLE_KINDS = new Set<GraphNode["kind"]>(["deposit", "facility"]);

function isMappable(node: GraphNode): boolean {
  return MAPPABLE_KINDS.has(node.kind);
}

function coordinatesOf(node: GraphNode) {
  return node.kind === "deposit" || node.kind === "facility" ? node.entity.coordinates : null;
}

export function locatedAssets(graph: GraphData): LocatedAsset[] {
  return graph.nodes.flatMap((node) => {
    const coordinates = isMappable(node) ? coordinatesOf(node) : null;
    if (!coordinates) return [];
    return [
      {
        node,
        latitude: coordinates.value.latitude,
        longitude: coordinates.value.longitude,
        provenance: coordinates.provenance,
      },
    ];
  });
}

export function unlocatedAssets(graph: GraphData): GraphNode[] {
  return graph.nodes.filter((node) => isMappable(node) && coordinatesOf(node) === null);
}
