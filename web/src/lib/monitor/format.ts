// Wording shared by the decision panel and the decision brief. Both state the
// same facts about the same graph, and a caveat phrased two ways reads as two
// different caveats.

export function pct(value: number): string {
  return value >= 0.1
    ? `${Math.round(value * 100)}%`
    : `${(value * 100).toFixed(1)}%`;
}

/**
 * The one-line caveat under the capacity share, in terms of what it means for
 * the reader rather than how it was computed.
 *
 * The share is struck against disclosed capacity only. If every plant that
 * lost feed is disclosed, the missing plants can only enlarge the denominator,
 * so the true share is no higher than shown. If one of the affected plants is
 * itself undisclosed, the numerator is short too and the figure is not bounded
 * either way. The two cases have to read differently.
 */
export function capacityCaveat(
  unknownRefiners: number,
  unknownAffected: number,
): string | null {
  if (unknownRefiners === 0) return null;
  const plants = `${unknownRefiners} refiner${unknownRefiners === 1 ? "" : "s"}`;
  if (unknownAffected === 0) {
    return `${plants} publish no capacity figure, so the true share is no higher than this.`;
  }
  const hit =
    unknownAffected === 1
      ? "one of them lost feed"
      : `${unknownAffected} of them lost feed`;
  return `${plants} publish no capacity figure and ${hit}, so the true share could be higher or lower.`;
}

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
