// Per-node OSINT: the client, and the presentation calls that go with it.
//
// The contract is deliberately generic — a node id, a corpus date and a ranked
// list of developments — and says nothing about how the ranking was produced.
// That is the point: the same shape has to come back whether a curated file or
// a collection pipeline is behind it, so nothing here may assume either.
//
// Two rules the rest of this module exists to hold.
//
// The order arrives ranked and is never re-sorted. How the list was ordered is
// a property of the producer, and re-sorting client-side would substitute our
// guess about relevance for theirs.
//
// `relevance_score` is for sorting and is never rendered. Painting 0.98 as
// "98%" reads as calibrated confidence about the world, which is not what a
// ranking score is. `priority` is the label meant for a reader, and it is the
// only one of the two that reaches the screen.

/** Same origin as the page; next.config.ts forwards it to the API server. */
const BASE = "/api";

/** How many developments the section shows before the reader asks for the rest. */
export const OSINT_SHOWN = 3;

export interface OsintSource {
  readonly name: string;
  /** Null on an unanchored item — render the name as text, never as a link. */
  readonly url: string | null;
}

/**
 * One prioritized development affecting the node.
 *
 * Everything past `source` is nullable even where this corpus always fills it:
 * a collector that cannot extract a field must still produce a card, so the
 * component has to tolerate every one of these being absent.
 */
export interface OsintDevelopment {
  readonly id: string;
  readonly title: string;
  readonly source: OsintSource;
  /** YYYY-MM-DD. */
  readonly published_at: string | null;
  /** A free string, never an enum: a new domain brings categories this build
   *  has never seen, and they have to render anyway. */
  readonly category: string | null;
  readonly priority: string | null;
  /** Ranking output, not confidence. See the module comment. */
  readonly relevance_score: number | null;
  readonly summary: string | null;
  readonly what_changed: string | null;
  readonly why_it_matters: string | null;
  readonly tags: readonly string[];
}

export interface NodeOsint {
  readonly node_id: string;
  /** When the corpus was produced — not when it was fetched. */
  readonly generated_at: string | null;
  /** Documents screened, where the producer records it. Null is a real answer
   *  and must read as "not recorded" rather than as zero. */
  readonly sources_analyzed: number | null;
  /** What the ordering is and is not, in the producer's words. The console
   *  cannot know how the ranking was made, so it must not author this. */
  readonly ranking_note: string | null;
  /** Best first, as ranked by the server. Do not re-sort. */
  readonly developments: readonly OsintDevelopment[];
}

/** Ranked developments for one node. Rejects with 404 for an id naming no asset. */
export async function fetchNodeOsint(
  nodeId: string,
  options: { readonly signal?: AbortSignal } = {},
): Promise<NodeOsint> {
  const res = await fetch(`${BASE}/assets/${nodeId}/osint`, {
    signal: options.signal,
  });
  if (!res.ok) throw new Error(`OSINT request failed for ${nodeId}: ${res.status}`);
  return (await res.json()) as NodeOsint;
}

// ── Priority ────────────────────────────────────────────────────────────────

/**
 * How loudly a development should read, which is the only thing priority is for.
 *
 * "unranked" is a fourth answer rather than a default. A producer in another
 * domain may send a label this build has never seen, and colouring it like a
 * top-priority item would promote it by accident — the same failure the API's
 * ranking avoids by sorting an unknown label below LOW.
 */
export type PriorityTone = "top" | "high" | "medium" | "low" | "unranked";

const TONE_BY_PRIORITY: Readonly<Record<string, PriorityTone>> = {
  VERY_HIGH: "top",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

export function priorityTone(priority: string | null | undefined): PriorityTone {
  if (!priority) return "unranked";
  return TONE_BY_PRIORITY[priority] ?? "unranked";
}

/**
 * The colour each tone borrows, from the severity family the console already
 * uses for "how much should you care". Medium and below are deliberately
 * colourless: a routine development must not compete with a severity square,
 * and only the top two tones are worth an eye-catch.
 */
export const PRIORITY_TONE_VAR: Readonly<Record<PriorityTone, string>> = {
  top: "--color-negative",
  high: "--color-accent",
  medium: "--color-text-secondary",
  low: "--color-text-tertiary",
  unranked: "--color-text-tertiary",
};

// ── Labels ──────────────────────────────────────────────────────────────────

/**
 * A SCREAMING_SNAKE value as the console's mono chrome renders it.
 *
 * Underscores become spaces and nothing else changes. Title-casing would have
 * to decide what OWNERSHIP_MA means, and any rule that gets "Offtake /
 * Financing" out of a two-word category turns PROJECT_STAGE_CHANGE into
 * "Project / Stage / Change". Passing the producer's own string through, in
 * the uppercase mono every other tag here uses, is right for any arity and
 * invents nothing.
 */
export function screamingLabel(value: string): string {
  return value.replace(/_/g, " ");
}

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/**
 * A publication date as "08 JUL 2026", matching the console's Zulu chrome.
 *
 * Read off the string rather than through `Date`, because `new Date("2026-07-08")`
 * is UTC midnight and a reader west of Greenwich would see the day before.
 * Returns null on anything it cannot parse: no date at all beats a wrong one,
 * and "Invalid Date" on a card is worse than both.
 */
export function publishedLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const name = MONTHS[Number(month) - 1];
  return name ? `${day} ${name} ${year}` : null;
}

/**
 * The counts under the section heading, as segments the summary joins.
 *
 * `sources_analyzed` leads where the producer records it. This corpus does not
 * — it is a curated file that never screened a measurable number of documents
 * — so the line reports what is actually knowable instead: how many
 * developments came back, and how many distinct publications they came from.
 * That second figure is not decoration; three cards from one outlet and three
 * from three are different evidence, and the reader cannot see which from a
 * collapsed list.
 */
export function summarySegments(data: NodeOsint): readonly string[] {
  const shown = data.developments.length;
  if (shown === 0) return [];
  const publications = new Set(data.developments.map((d) => d.source.name)).size;
  const segments = [`${shown} prioritized`];
  if (data.sources_analyzed != null) {
    segments.unshift(`${data.sources_analyzed} screened`);
  }
  segments.push(`${publications} publication${publications === 1 ? "" : "s"}`);
  const corpus = publishedLabel(data.generated_at);
  if (corpus) segments.push(`Corpus ${corpus}`);
  return segments;
}
