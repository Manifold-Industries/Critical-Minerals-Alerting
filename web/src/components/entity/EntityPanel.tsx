"use client";

import { useMemo } from "react";
import type { GraphData, GraphNode, Source } from "@/lib/api/types";
import { fieldRowsFor } from "@/lib/provenance/fields";
import { KIND_STYLE } from "@/lib/graph/styles";
import { ProvenanceRow } from "@/components/entity/ProvenanceRow";

interface EntityPanelProps {
  node: GraphNode;
  graph: GraphData;
  onClose: () => void;
}

export function useGraphLookups(graph: GraphData) {
  return useMemo(() => {
    const names = new Map<string, string>();
    for (const node of graph.nodes) names.set(node.id, node.name);
    for (const country of graph.context.countries) names.set(country.id, country.name);
    const sources = new Map<string, Source>(graph.context.sources.map((source) => [source.id, source]));
    return {
      sources,
      resolveName: (id: string) => names.get(id) ?? id,
    };
  }, [graph]);
}

/** Evidence panel: every attested field of the selected entity, with its provenance. */
export function EntityPanel({ node, graph, onClose }: EntityPanelProps) {
  const { sources, resolveName } = useGraphLookups(graph);
  const rows = fieldRowsFor(node, resolveName);
  const style = KIND_STYLE[node.kind];
  const description = "description" in node.entity ? node.entity.description : null;

  return (
    <aside className="flex w-96 shrink-0 flex-col overflow-y-auto border-l border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{node.name}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="rounded px-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          ×
        </button>
      </div>
      <p className="mb-3">
        <span className={`rounded px-1.5 py-0.5 text-[11px] ${style.badge}`}>{style.label}</span>
      </p>
      {description && <p className="mb-3 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{description}</p>}
      <dl className="space-y-3">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`}>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {row.label}
            </dt>
            <dd className="text-xs leading-5 text-zinc-800 dark:text-zinc-200">{row.value}</dd>
            {row.provenance && <ProvenanceRow provenance={row.provenance} sources={sources} />}
          </div>
        ))}
      </dl>
    </aside>
  );
}
