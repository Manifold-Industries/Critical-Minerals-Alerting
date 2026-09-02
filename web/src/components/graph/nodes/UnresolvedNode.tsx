"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { UNRESOLVED_STYLE } from "@/lib/graph/styles";

/** Hollow "?" target for an UNRESOLVED edge — a visible dangling dependency. */
export function UnresolvedNode(props: NodeProps) {
  return (
    <div
      className={`flex w-[180px] items-center justify-center gap-2 rounded-md border-2 px-2 py-1 ${UNRESOLVED_STYLE.container} ${
        props.selected ? "ring-2 ring-zinc-900 dark:ring-zinc-100" : ""
      }`}
    >
      <Handle type="target" position={Position.Left} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <span className="text-base font-bold">?</span>
      <span className="text-[10px]">counterparty unknown</span>
      <Handle type="source" position={Position.Right} className="!h-1 !w-1 !border-0 !bg-transparent" />
    </div>
  );
}
