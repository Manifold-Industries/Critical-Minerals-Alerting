// Text assembly for the decision brief.
//
// Every sentence here is a fixed template with values from the supply graph
// dropped in. Nothing is estimated, summarised or reworded, and a sentence
// whose values are missing is left out rather than written around - so the
// brief can be wrong only where the graph is, and can be checked against it
// line by line.
//
// Runtime imports carry `.ts` so `node --test` can load this file as it stands.

import type { Alert } from "./alerts";
import type { MineExposure } from "./api";
import type { AlertGraph } from "./graphs";
import { capacityCaveat, pct } from "./format.ts";
import {
  BASE_FACTOR,
  FACTOR_NAME,
  RANK_FACTORS,
  factorAvailability,
  type FactorWeights,
} from "./ranking.ts";

/** How many systems the bottom line names before leaving the rest to section 3. */
const SYSTEMS_NAMED = 2;
/** Joint leaders named before the sentence stops being readable. */
const LEADERS_NAMED = 3;

export interface BriefInputs {
  readonly alert: Pick<Alert, "severity">;
  readonly graph: AlertGraph | undefined;
  readonly exposure: Pick<MineExposure, "elements" | "platforms" | "warnings"> | undefined;
  /** Null where the reader set no ranking; the default order is then in force. */
  readonly weights: FactorWeights | null;
}

/** "a", "a and b", "a, b and c". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "country alignment ×1 and uncommitted supply ×5", in panel order. */
export function weightsPhrase(weights: FactorWeights): string {
  return joinNames(
    RANK_FACTORS.filter((factor) => (weights[factor] ?? 0) > 0).map(
      (factor) => `${(FACTOR_NAME[factor] ?? factor).toLowerCase()} ×${weights[factor]}`,
    ),
  );
}

function capacityLine(graph: AlertGraph): string | null {
  const ctx = graph.capacity;
  if (!ctx) return null;
  if (ctx.affected_share == null || ctx.affected_tpa == null) {
    return "The share of Dy/Tb separation capacity that lost feed cannot be sized: no affected plant publishes a capacity figure. It is not zero.";
  }
  return `${pct(ctx.affected_share)} of known Dy/Tb separation capacity lost feed: ${ctx.affected_tpa.toLocaleString("en-US")} of ${ctx.total_tpa.toLocaleString("en-US")} tonnes a year, on ${ctx.as_of_year} figures.`;
}

function plantsLine(graph: AlertGraph): string | null {
  const plants = graph.downstream;
  if (plants.length === 0) return null;
  const lose = `${plural(plants.length, "downstream plant loses", "downstream plants lose")} feed`;
  // Fixture graphs carry no supplier counts; say nothing rather than "none".
  if (plants.every((p) => p.soleSource === undefined)) return `${lose}.`;
  const sole = plants.filter((p) => p.soleSource).length;
  if (sole === 0) return `${lose}, and each keeps at least one other supplier.`;
  if (plants.length === 1) return `${lose}, and it has no other supplier.`;
  if (sole === plants.length) return `${lose}, and none of them has another supplier.`;
  return `${lose}, and ${sole} of them ${sole === 1 ? "has" : "have"} no other supplier.`;
}

function systemsLine(exposure: BriefInputs["exposure"]): string | null {
  if (!exposure || exposure.platforms.length === 0) return null;
  const named = exposure.platforms.slice(0, SYSTEMS_NAMED).map((p) => p.name);
  const count = plural(
    exposure.platforms.length,
    "weapons system depends",
    "weapons systems depend",
  );
  const including =
    exposure.platforms.length > named.length ? "including " : "";
  return `${count} on ${joinNames(exposure.elements)}, ${including}${joinNames(named)}.`;
}

function alternativesLine(
  graph: AlertGraph,
  weights: FactorWeights | null,
): string | null {
  const [first, ...others] = graph.alternatives;
  if (!first) return null;
  // A fixture list has an order and no scores, so no basis to state.
  if (first.score == null) {
    return `${first.name} (${first.country}) is listed first as a replacement source.`;
  }
  const basis = weights
    ? `weighted on ${weightsPhrase(weights)}`
    : "on country alignment alone, the default";
  const joint = others.filter((alt) => alt.score === first.score);
  if (joint.length === 0) {
    return `${first.name} (${first.country}) ranks first as a replacement source, ${basis}.`;
  }
  const leaders = [first, ...joint];
  const names = leaders.slice(0, LEADERS_NAMED).map((alt) => alt.name);
  const more = leaders.length - names.length;
  const listed = more > 0 ? `${names.join(", ")} and ${more} more` : joinNames(names);
  return `${listed} rank joint first as replacement sources, ${basis}.`;
}

/** The assessment, a sentence per fact the graph holds. */
export function bottomLine({
  alert,
  graph,
  exposure,
  weights,
}: BriefInputs): readonly string[] {
  if (!graph) return [`A ${alert.severity}-severity disruption is reported.`];
  const where = [graph.asset.name, graph.asset.place].filter(Boolean).join(", ");
  return [
    `A ${alert.severity}-severity disruption is reported at ${where}.`,
    capacityLine(graph),
    plantsLine(graph),
    systemsLine(exposure),
    alternativesLine(graph, weights),
  ].filter((line): line is string => line !== null);
}

// True of every simulated brief, whatever the data: they describe what the
// graph does not model at all. Drawn from the engine's own account of its
// limits at the top of api/src/disruption.py.
const STANDING_LIMITS: readonly string[] = [
  "End-use dependencies are open-source claims about platform classes, not bills of material. Nothing here shows that metal from this site reached a particular system.",
  "Tonnages are not on one basis: mine figures are contained metal, plant figures are separated-oxide nameplate, and the graph holds no recovery factor. Any coverage of the gap is an upper bound.",
  "Commercial exclusivity, such as offtake rights or a right of first refusal, is not modelled. A ranked source may not be free to supply.",
];

const FIXTURE_LIMIT =
  "This alert has no simulation behind it. Its sites and alternatives are seeded placeholders, not output of the supply graph.";

/** What the brief cannot support: the engine's warnings, then the data gaps. */
export function briefLimits({
  graph,
  exposure,
  weights,
}: Omit<BriefInputs, "alert">): readonly string[] {
  if (!graph?.candidates) return graph ? [FIXTURE_LIMIT] : [];

  const ctx = graph.capacity;
  const caveat = ctx
    ? capacityCaveat(
        ctx.refiners_total - ctx.refiners_disclosing,
        ctx.undisclosed_facility_ids.length,
      )
    : null;

  const inPlay = weights ?? { [BASE_FACTOR]: 1 };
  const gaps = factorAvailability(graph.candidates).flatMap((f) => {
    const name = FACTOR_NAME[f.factor] ?? f.factor;
    const of = `${f.missing} of ${plural(f.total, "candidate", "candidates")}`;
    if (!f.available) {
      return [`"${name}" could not be weighted: ${of} ${f.missing === 1 ? "has" : "have"} no data for it.`];
    }
    if (f.missing > 0 && (inPlay[f.factor] ?? 0) > 0) {
      return [`${of} ${f.missing === 1 ? "is" : "are"} in a country with no alignment assessment. They are scored as neutral and marked "?".`];
    }
    return [];
  });

  return [
    ...(graph.warnings ?? []),
    ...(exposure?.warnings ?? []),
    ...(caveat ? [`Capacity share: ${caveat}`] : []),
    ...gaps,
    ...STANDING_LIMITS,
  ];
}
