// Client-side re-ranking of alternative sources under reader-chosen weights.
//
// The engine returns every factor measured and normalised to [0, 1] on every
// candidate, whatever weights it ran under, precisely so that re-weighting is a
// caller decision. This is the same arithmetic as `_score` in
// api/src/disruption.py: weight, renormalise over the weights in play, 0-100.

import type { AlternativeSource, ScoreFactorBreakdown } from "./graphs";

/** Factor id -> relative weight. Absent and zero both mean "not in play". */
export type FactorWeights = Readonly<Record<string, number>>;

/** Every ScoreFactor in api/src/disruption.py, in the order the panel lists them. */
export const RANK_FACTORS = [
  "alignment",
  "time_to_flow",
  "coverage",
  "commitment",
  "evidence",
  "confidence",
] as const;

export const FACTOR_NAME: Readonly<Record<string, string>> = {
  alignment: "Country alignment",
  time_to_flow: "Time to flow",
  coverage: "Coverage of the gap",
  commitment: "Prior commitment",
  evidence: "Evidence class",
  confidence: "Assertion confidence",
};

/**
 * The factor a ranking starts from, and the one exception to the completeness
 * rule below: it stays selectable where a country carries no assessment,
 * because without it there is nothing to start from. The gap is still counted
 * in `FactorAvailability.missing`, so the panel can say so.
 */
export const BASE_FACTOR = "alignment";

/** Mirrors DEFAULT_WEIGHTS on the server: alignment alone. */
export const DEFAULT_FACTOR_WEIGHTS: FactorWeights = { [BASE_FACTOR]: 1 };

export const MAX_FACTOR_WEIGHT = 5;

/** Ranked alternatives shown in the rail and drawn on the globe. */
export const ALTERNATIVES_SHOWN = 5;

// Matches _SCORE_DP on the server, so a default-weight score computed here
// equals the one the engine returned.
const SCORE_DP = 6;

function round(value: number): number {
  return Number(value.toFixed(SCORE_DP));
}

export interface FactorAvailability {
  readonly factor: string;
  /** Candidates in the pool. */
  readonly total: number;
  /** Candidates where a fallback stood in for data the graph does not hold. */
  readonly missing: number;
  readonly available: boolean;
}

/**
 * Which factors the pool holds complete data for, in `RANK_FACTORS` order.
 *
 * Counted in sources, not pairings: the pool repeats a source once per plant it
 * could feed, and "4 of 37" against a list of 19 mines is not a readable
 * figure. A source is missing a factor if any of its pairings is.
 */
export function factorAvailability(
  candidates: readonly AlternativeSource[],
): readonly FactorAvailability[] {
  const sourceIds = new Set(candidates.map((c) => c.id));
  return RANK_FACTORS.map((factor) => {
    const missing = new Set(
      candidates
        .filter((c) => !c.scoreFactors?.find((f) => f.factor === factor)?.known)
        .map((c) => c.id),
    ).size;
    return {
      factor,
      total: sourceIds.size,
      missing,
      available: sourceIds.size > 0 && (missing === 0 || factor === BASE_FACTOR),
    };
  });
}

function rescore(
  candidate: AlternativeSource,
  weights: FactorWeights,
  totalWeight: number,
): AlternativeSource {
  const scoreFactors: readonly ScoreFactorBreakdown[] = (
    candidate.scoreFactors ?? []
  ).map((f) => {
    const weight = weights[f.factor] ?? 0;
    return {
      ...f,
      contribution: round((100 * weight * f.normalized) / totalWeight),
      maxContribution: round((100 * weight) / totalWeight),
    };
  });
  // Summed from the rounded contributions, as the server does, so the parts
  // add up to the whole exactly.
  const score = round(scoreFactors.reduce((sum, f) => sum + f.contribution, 0));
  return { ...candidate, score, scoreFactors };
}

/**
 * Rank a candidate pool under `weights`, best first, capped at `limit`.
 *
 * The pool is one row per (source, plant) pairing in the engine's own order.
 * The sort is stable, so equal scores keep that order — the engine breaks ties
 * on a key it does not serialise. A source that could feed two plants is kept
 * once, at whichever pairing scores higher. Returns nothing when no weight is
 * in play: there is no score to rank on.
 */
export function rankCandidates(
  candidates: readonly AlternativeSource[],
  weights: FactorWeights,
  limit: number,
): readonly AlternativeSource[] {
  const totalWeight = RANK_FACTORS.reduce(
    (sum, factor) => sum + (weights[factor] ?? 0),
    0,
  );
  if (totalWeight <= 0) return [];

  const sorted = candidates
    .map((c) => rescore(c, weights, totalWeight))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const seen = new Set<string>();
  const unique = sorted.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  return unique.slice(0, limit).map((c, i) => ({ ...c, rank: i + 1 }));
}
