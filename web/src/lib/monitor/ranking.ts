// Client-side re-ranking of alternative sources under reader-chosen weights.
//
// The engine returns every factor measured and normalised to [0, 1] on every
// candidate, whatever weights it ran under, precisely so that re-weighting is a
// caller decision. This is the same arithmetic as `_score` in
// api/src/disruption.py: weight, renormalise over the weights in play, 0-100.

import type { AlternativeSource, ScoreFactorBreakdown } from "./graphs";

/** Factor id -> relative weight. Absent and zero both mean "not in play". */
export type FactorWeights = Readonly<Record<string, number>>;

/**
 * The factors a reader can weight, in the order the panel lists them.
 *
 * Four of the engine's six. `evidence` and `confidence` are left out on
 * purpose: they grade how well the graph knows about a link, not how good the
 * source is, and "prefer the mines we are surer of" is not a sourcing
 * preference. They still come back on every candidate; nothing here reads them.
 */
export const RANK_FACTORS = [
  "alignment",
  "coverage",
  "time_to_flow",
  "commitment",
] as const;

export const FACTOR_NAME: Readonly<Record<string, string>> = {
  alignment: "Country alignment",
  coverage: "Capacity to cover the gap",
  time_to_flow: "Time to flow",
  commitment: "Uncommitted supply",
};

/** What a higher weight asks for, in the reader's terms. Kept to what the
 *  engine actually measures — see `_measure` in api/src/disruption.py. */
export const FACTOR_DESCRIPTION: Readonly<Record<string, string>> = {
  alignment:
    "Where the mine is. Domestic ranks first, then ally, partner, neutral, adversary.",
  coverage:
    "How much of the lost Dy/Tb tonnage the mine's own output could replace.",
  time_to_flow:
    "How soon material could arrive: time to first production plus qualifying it at the plant.",
  commitment:
    "Favours mines whose output is not already contracted to another plant.",
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

/** Only `RANK_FACTORS` carry weight, so a stray key cannot push a score past
 *  the total it is renormalised over. */
function weightOf(weights: FactorWeights, factor: string): number {
  return (RANK_FACTORS as readonly string[]).includes(factor)
    ? (weights[factor] ?? 0)
    : 0;
}

function rescore(
  candidate: AlternativeSource,
  weights: FactorWeights,
  totalWeight: number,
): AlternativeSource {
  const scoreFactors: readonly ScoreFactorBreakdown[] = (
    candidate.scoreFactors ?? []
  ).map((f) => {
    const weight = weightOf(weights, f.factor);
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
    (sum, factor) => sum + weightOf(weights, factor),
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

// ── Weights in a URL ───────────────────────────────────────────────────────
//
// The decision brief is opened by link, so the weights a ranking was struck on
// travel as `alignment:2,commitment:5`. A URL is outside input: anything the
// panel itself could not have produced is refused whole rather than repaired,
// because a brief that quietly ranks on different weights than its link says
// is worse than one that says the link was bad.

/** Weights in play, in `RANK_FACTORS` order. Zeroes and unknown keys are dropped. */
export function formatWeights(weights: FactorWeights): string {
  return RANK_FACTORS.filter((factor) => weightOf(weights, factor) > 0)
    .map((factor) => `${factor}:${weights[factor]}`)
    .join(",");
}

/** Null where `raw` is absent or is not something `formatWeights` could emit. */
export function parseWeights(raw: string | undefined): FactorWeights | null {
  if (!raw) return null;
  const entries: [string, number][] = [];
  for (const part of raw.split(",")) {
    const [factor, value, ...rest] = part.split(":");
    const weight = Number(value);
    const valid =
      rest.length === 0 &&
      (RANK_FACTORS as readonly string[]).includes(factor) &&
      Number.isInteger(weight) &&
      weight >= 1 &&
      weight <= MAX_FACTOR_WEIGHT &&
      !entries.some(([seen]) => seen === factor);
    if (!valid) return null;
    entries.push([factor, weight]);
  }
  return Object.fromEntries(entries);
}
