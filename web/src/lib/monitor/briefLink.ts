// The decision brief's URL: `/brief?alert=SA-047&year=2027&w=alignment:2`.
//
// Everything the document depends on is in the link, so opening it again
// rebuilds the same brief. It is also outside input, so it is validated here
// before anything reads it.

import type { Alert } from "./alerts";
// `.ts` on a runtime import so `node --test` can load this file as it stands.
import { formatWeights, parseWeights, type FactorWeights } from "./ranking.ts";

export const BRIEF_PATH = "/brief";

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

export interface BriefRequest {
  /** Undefined where the link names no alert, or one that does not exist. */
  readonly alert?: Alert;
  readonly year?: number;
  /** Null where the link carries no usable weights; the brief then keeps the
   *  engine's default order and says so. */
  readonly weights: FactorWeights | null;
  /** What was wrong with the link, in the reader's terms. */
  readonly problem?: string;
}

export function briefHref(
  alertId: string,
  options: { readonly year?: number; readonly weights?: FactorWeights | null } = {},
): string {
  const params = new URLSearchParams({ alert: alertId });
  if (options.year !== undefined) params.set("year", String(options.year));
  const weights = options.weights ? formatWeights(options.weights) : "";
  if (weights) params.set("w", weights);
  return `${BRIEF_PATH}?${params}`;
}

function single(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

export function parseBriefParams(
  params: Readonly<Record<string, string | readonly string[] | undefined>>,
  alerts: readonly Alert[],
): BriefRequest {
  const alertId = single(params.alert);
  if (!alertId) return { weights: null };
  const alert = alerts.find((a) => a.id === alertId);
  if (!alert) {
    return { weights: null, problem: `No alert with the id "${alertId}".` };
  }

  const problems: string[] = [];
  const rawYear = single(params.year);
  const parsedYear = Number(rawYear);
  const yearValid =
    Number.isInteger(parsedYear) && parsedYear >= MIN_YEAR && parsedYear <= MAX_YEAR;
  if (rawYear !== undefined && !yearValid) {
    problems.push("The link's year was not usable, so the default year is used.");
  }

  const rawWeights = single(params.w);
  const weights = parseWeights(rawWeights);
  if (rawWeights !== undefined && !weights) {
    problems.push(
      "The link's weights were not usable, so alternatives keep the default order.",
    );
  }

  return {
    alert,
    year: rawYear !== undefined && yearValid ? parsedYear : undefined,
    weights,
    problem: problems.length > 0 ? problems.join(" ") : undefined,
  };
}
