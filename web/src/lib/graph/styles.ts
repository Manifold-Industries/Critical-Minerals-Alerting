/**
 * The single home of every visual encoding in the graph views.
 *
 * Components and the Legend consume these tables; no colour, dash pattern
 * or stroke width literal may exist anywhere else.
 */
import type { Confidence, EdgeStatus, EdgeType, GraphEdge, NodeKind } from "@/lib/api/types";

/** SVG stroke style for an edge; structurally assignable to CSSProperties. */
export interface EdgeStyle {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  opacity: number;
}

export interface KindStyle {
  label: string;
  /** Tailwind classes for the node card. */
  container: string;
  /** Tailwind classes for the kind badge. */
  badge: string;
}

export const KIND_STYLE: Record<NodeKind, KindStyle> = {
  deposit: {
    label: "Deposit",
    container: "border-amber-500 bg-amber-50 dark:border-amber-600 dark:bg-amber-950",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  project: {
    label: "Project / Mine",
    container: "border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
  facility: {
    label: "Facility",
    container: "border-sky-500 bg-sky-50 dark:border-sky-600 dark:bg-sky-950",
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  },
  material: {
    label: "Material",
    container: "border-violet-500 bg-violet-50 dark:border-violet-600 dark:bg-violet-950",
    badge: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  },
  component: {
    label: "Component",
    container: "border-fuchsia-500 bg-fuchsia-50 dark:border-fuchsia-600 dark:bg-fuchsia-950",
    badge: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200",
  },
  system: {
    label: "Defence system",
    container: "border-rose-500 bg-rose-50 dark:border-rose-600 dark:bg-rose-950",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  },
  organization: {
    label: "Organization",
    container: "border-zinc-400 bg-zinc-50 dark:border-zinc-500 dark:bg-zinc-900",
    badge: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300",
  },
};

export const UNRESOLVED_STYLE = {
  label: "Unresolved counterparty",
  container:
    "border-dashed border-zinc-400 bg-transparent text-zinc-500 dark:border-zinc-500 dark:text-zinc-400",
};

/** Mid-tone stroke colours legible on both light and dark grounds. */
export const TYPE_COLOR: Record<EdgeType, string> = {
  SUPPLIES: "#64748b",
  PRODUCES: "#64748b",
  REQUIRES: "#64748b",
  INVESTED_IN: "#d97706",
  ALTERNATIVE_TO: "#8b5cf6",
  DEVELOPS: "#a1a1aa",
  OPERATES: "#a1a1aa",
  SUBSIDIARY_OF: "#a1a1aa",
};

export const TYPE_LEGEND: { types: EdgeType[]; label: string; color: string }[] = [
  { types: ["SUPPLIES", "PRODUCES", "REQUIRES"], label: "Material flow / dependency", color: TYPE_COLOR.SUPPLIES },
  { types: ["INVESTED_IN"], label: "Investment", color: TYPE_COLOR.INVESTED_IN },
  { types: ["ALTERNATIVE_TO"], label: "Alternative", color: TYPE_COLOR.ALTERNATIVE_TO },
  { types: ["DEVELOPS", "OPERATES", "SUBSIDIARY_OF"], label: "Structure (derived)", color: TYPE_COLOR.DEVELOPS },
];

/** Dash pattern per evidentiary status; solid means happening / in force. */
export const STATUS_DASH: Record<EdgeStatus, string | undefined> = {
  OBSERVED: undefined,
  CONTRACTED: undefined,
  PLANNED: "8 4",
  POTENTIAL: "8 4",
  UNRESOLVED: "2 4",
  HISTORICAL: undefined,
};

export const STATUS_LEGEND: { statuses: EdgeStatus[]; label: string; dash?: string; muted?: boolean }[] = [
  { statuses: ["OBSERVED", "CONTRACTED"], label: "Observed / contracted", dash: STATUS_DASH.OBSERVED },
  { statuses: ["PLANNED", "POTENTIAL"], label: "Planned / potential", dash: STATUS_DASH.PLANNED },
  { statuses: ["UNRESOLVED"], label: "Unresolved counterparty", dash: STATUS_DASH.UNRESOLVED },
  { statuses: ["HISTORICAL"], label: "Historical", dash: STATUS_DASH.HISTORICAL, muted: true },
];

interface ConfidenceStroke {
  strokeWidth: number;
  opacity: number;
}

export const CONFIDENCE_STROKE: Record<Confidence, ConfidenceStroke> = {
  HIGH: { strokeWidth: 2.4, opacity: 0.95 },
  MEDIUM: { strokeWidth: 1.8, opacity: 0.75 },
  LOW: { strokeWidth: 1.2, opacity: 0.5 },
};

const NO_CONFIDENCE_STROKE: ConfidenceStroke = { strokeWidth: 1.4, opacity: 0.65 };
const HISTORICAL_COLOR = "#9ca3af";
const HISTORICAL_OPACITY_FACTOR = 0.5;

export function edgeStyleFor(edge: GraphEdge): EdgeStyle {
  const confidence = edge.provenance?.assertion_confidence ?? null;
  const stroke = confidence ? CONFIDENCE_STROKE[confidence] : NO_CONFIDENCE_STROKE;
  const historical = edge.status === "HISTORICAL";
  return {
    stroke: historical ? HISTORICAL_COLOR : TYPE_COLOR[edge.type],
    strokeWidth: stroke.strokeWidth,
    strokeDasharray: STATUS_DASH[edge.status],
    opacity: historical ? stroke.opacity * HISTORICAL_OPACITY_FACTOR : stroke.opacity,
  };
}
