"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import type { GraphEdge } from "@/lib/api/types";
import { edgeStyleFor } from "@/lib/graph/styles";

/** Edge styled by status (dash), confidence (weight/opacity) and type (colour). */
export function StatusEdge(props: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });
  const edge = props.data?.edge as GraphEdge;
  const label = typeof props.data?.label === "string" ? props.data.label : null;

  return (
    <>
      <BaseEdge id={props.id} path={path} style={edgeStyleFor(edge)} markerEnd={props.markerEnd} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            className="pointer-events-none absolute max-w-40 truncate rounded bg-white/80 px-1 text-[9px] text-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-400"
            title={label}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
