// The ranking factors a reader can weight, and everything the console says
// about each one.
//
// One entry per factor, in the order the panel lists them. Adding a factor is
// an entry here and a rank table on the server; nothing else in the client has
// to learn about it. Kept apart from `ranking.ts`, which is arithmetic and has
// no opinion about names or colour.
//
// These are four of the engine's six. `evidence` and `confidence` are left out
// on purpose: they grade how well the graph knows about a link, not how good
// the source is, and "prefer the mines we are surer of" is not a sourcing
// preference. They still come back on every candidate; nothing here reads them.

export interface FactorDescriptor {
  /** Matches `ScoreFactor` in api/src/disruption.py. */
  readonly id: string;
  readonly name: string;
  /** What a higher weight asks for, in the reader's terms. Kept to what the
   *  engine actually measures — see `_measure` in api/src/disruption.py. */
  readonly description: string;
  /** Fixed, so a factor keeps its colour from one ranking to the next and the
   *  legend can be read against the bars. Shades of the one accent rather than
   *  new hues: the console has a single signal colour. */
  readonly shade: string;
}

export const FACTORS: readonly FactorDescriptor[] = [
  {
    id: "alignment",
    name: "Country alignment",
    description:
      "Where the mine is. Domestic ranks first, then ally, partner, neutral, adversary.",
    shade: "var(--accent)",
  },
  {
    id: "coverage",
    name: "Capacity to cover the gap",
    description:
      "How much of the lost Dy/Tb tonnage the mine's own output could replace.",
    shade: "color-mix(in srgb, var(--accent) 72%, transparent)",
  },
  {
    id: "operating_status",
    name: "Operating status",
    description:
      "Whether the mine is producing. Operating ranks first, then commissioning, under construction, and planned or suspended together.",
    shade: "color-mix(in srgb, var(--accent) 52%, transparent)",
  },
  {
    id: "commitment",
    name: "Uncommitted supply",
    description:
      "Favours mines whose output is not already contracted to another plant.",
    shade: "color-mix(in srgb, var(--accent) 36%, transparent)",
  },
];

/** Factor ids, in the order the panel lists them. */
export const RANK_FACTORS: readonly string[] = FACTORS.map((f) => f.id);

/**
 * The factor a ranking starts from, and the one exception to the completeness
 * rule in `factorAvailability`: it stays selectable where a country carries no
 * assessment, because without it there is nothing to start from. The gap is
 * still counted in `FactorAvailability.missing`, so the panel can say so.
 */
export const BASE_FACTOR = "alignment";

const BY_ID = new Map(FACTORS.map((f) => [f.id, f]));

/** Reader-facing name, falling back to the raw id so an engine factor the
 *  client has not been taught about still prints as something. */
export function factorName(id: string): string {
  return BY_ID.get(id)?.name ?? id;
}

export function factorDescription(id: string): string | undefined {
  return BY_ID.get(id)?.description;
}

export function factorShade(id: string): string {
  return BY_ID.get(id)?.shade ?? "var(--accent)";
}
