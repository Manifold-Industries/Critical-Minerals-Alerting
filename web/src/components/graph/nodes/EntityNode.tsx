"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Facility, GraphNode, Project } from "@/lib/api/types";
import { KIND_STYLE } from "@/lib/graph/styles";
import { pretty } from "@/lib/provenance/fields";

function statusFor(node: GraphNode): string | null {
  if (node.kind === "project") {
    return (node.entity as Project).development_stage.value;
  }
  if (node.kind === "facility") {
    return (node.entity as Facility).operating_status.value;
  }
  return null;
}

function countryFor(node: GraphNode): string | null {
  if ("country_id" in node.entity) return node.entity.country_id;
  if ("headquarters_country_id" in node.entity) return node.entity.headquarters_country_id;
  return null;
}

export function EntityNode(props: NodeProps) {
  const graphNode = props.data.graphNode as GraphNode;
  const style = KIND_STYLE[graphNode.kind];
  const status = statusFor(graphNode);
  const country = countryFor(graphNode);

  return (
    <div
      className={`w-[180px] rounded-md border px-2 py-1 shadow-sm ${style.container} ${
        props.selected ? "ring-2 ring-zinc-900 dark:ring-zinc-100" : ""
      }`}
    >
      <Handle type="target" position={Position.Left} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100" title={graphNode.name}>
        {graphNode.name}
      </p>
      <p className="flex items-center gap-1 text-[10px] leading-4">
        <span className={`rounded px-1 ${style.badge}`}>{style.label}</span>
        {country && <span className="text-zinc-500 dark:text-zinc-400">{country}</span>}
        {status && <span className="truncate text-zinc-500 dark:text-zinc-400">{pretty(status)}</span>}
      </p>
      <Handle type="source" position={Position.Right} className="!h-1 !w-1 !border-0 !bg-transparent" />
    </div>
  );
}
