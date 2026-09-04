// Display formatting shared by the decision panel and the brief. These render
// the same underlying facts in both places, so they live in one module — a
// share that prints differently on the brief than on the panel is a bug.

/** Percentage with one decimal below 10%, none above. */
export function pct(value: number): string {
  return value >= 0.1
    ? `${Math.round(value * 100)}%`
    : `${(value * 100).toFixed(1)}%`;
}

/** "OPERATING_PARTIAL" → "Operating partial". */
export function statusLabel(status: string): string {
  const s = status.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Sole source" is the fact that decides whether an outage is survivable. */
export function supplyLabel(node: {
  readonly soleSource?: boolean;
  readonly remainingSupplies?: number;
}): string | null {
  if (node.soleSource === undefined) return null;
  if (node.soleSource) return "Sole source";
  const n = node.remainingSupplies ?? 0;
  return `${n} other supplier${n === 1 ? "" : "s"}`;
}

/** Display names for the score factors, keyed by ScoreFactor in
 *  api/src/disruption.py. */
export const FACTOR_NAME: Record<string, string> = {
  time_to_flow: "Time to flow",
  coverage: "Coverage of the gap",
  evidence: "Evidence class",
  alignment: "Country alignment",
  commitment: "Prior commitment",
  confidence: "Assertion confidence",
};
