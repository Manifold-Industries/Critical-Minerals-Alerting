// Geographic dependency graphs backing the globe, one per alert id.
//
// Placeholder seed data for alerts with no engine behind them. An alert that
// carries a `mineId` is not in here: its graph is fetched from the disruption
// API and adapted by `toAlertGraph`, so it follows the supply graph instead of
// going stale against it.

export type ImpactLevel = "high" | "medium" | "low";

export interface GeoNode {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly place: string;
  readonly lon: number;
  readonly lat: number;
}

export interface DownstreamNode extends GeoNode {
  readonly impact: ImpactLevel;
  /**
   * Live-graph detail. Optional because the placeholder fixtures below have no
   * engine behind them and cannot honestly claim any of it.
   */
  readonly soleSource?: boolean;
  /** Suppliers still feeding this plant once the disrupted mine is removed. */
  readonly remainingSupplies?: number;
  readonly operatingStatus?: string;
  /** Lost tonnage over this plant's nameplate. Upper bound: the two figures
   *  are struck at different points in the chain. */
  readonly shareOfNameplate?: number;
  /** This plant's nameplate over all *disclosed* Dy+Tb separation capacity. */
  readonly shareOfModelledCapacity?: number;
}

export interface DependencyEdge {
  readonly from: string;
  readonly to: string;
  /** Transport routes render dashed. */
  readonly transport?: boolean;
}

/** One factor's part of a candidate's score. */
export interface ScoreFactorBreakdown {
  readonly factor: string;
  /** Display form of the underlying value: "PARTNER", "WITHIN_12M", "PARTIAL". */
  readonly label: string;
  /** Points of the score. Contributions sum to the score itself. */
  readonly contribution: number;
  /** Points this factor could have contributed. Zero where it was excluded. */
  readonly maxContribution: number;
  /** False where a fallback stood in for data the graph does not hold. Hiding
   *  this presents a guess with the same authority as a disclosure. */
  readonly known: boolean;
  readonly detail: string | null;
}

export interface AlternativeSource {
  readonly id: string;
  readonly rank: number;
  readonly name: string;
  readonly country: string;
  readonly lon: number;
  readonly lat: number;
  /** Node id (asset or downstream) this source would feed. */
  readonly feedsNodeId: string;
  /** 0 curated, 1 inferred. The inferred layer calls itself "not evidence". */
  readonly evidenceClass?: number;
  /** Composite score, 0-100, higher is better. Absent on the static seed
   *  graphs, which predate scoring and carry an order without a number. */
  readonly score?: number;
  /** The factors behind `score`. Their contributions sum to it. */
  readonly scoreFactors?: readonly ScoreFactorBreakdown[];
  /** What put this row below the one above. A ScoreFactor where `decisiveBasis`
   *  is SCORE, a RankingKey field where it is TIEBREAK. */
  readonly decisiveFactor?: string | null;
  /** SCORE where the two rows scored differently, TIEBREAK where they did not. */
  readonly decisiveBasis?: string | null;
  /** Points the decisive factor was worth, on SCORE only. A 0.4 gap and a 30
   *  gap are both "ranked lower" and must not read alike. */
  readonly decisiveMargin?: number | null;
  /** The score could not separate this row from the one above at all. */
  readonly tiedWithPrevious?: boolean;
}

/** The weights a live graph's scores were computed under. */
export interface ScoringPolicy {
  readonly version: string;
  readonly weights: Readonly<Record<string, number>>;
  readonly excludedFactors: readonly string[];
}

/** Systemic weight of the plants that lost feed. Live graphs only. */
export interface CapacityContext {
  readonly as_of_year: number;
  readonly total_tpa: number;
  readonly refiners_disclosing: number;
  readonly refiners_total: number;
  readonly affected_tpa: number | null;
  readonly affected_share: number | null;
  readonly undisclosed_facility_ids: readonly string[];
}

export interface AlertGraph {
  readonly capacity?: CapacityContext;
  /** Live graphs only. Weights are an input, so the panel cannot explain a
   *  score without them. */
  readonly scoring?: ScoringPolicy;
  readonly asset: GeoNode;
  readonly downstream: readonly DownstreamNode[];
  readonly edges: readonly DependencyEdge[];
  readonly alternatives: readonly AlternativeSource[];
}

export const GRAPHS: Readonly<Record<string, AlertGraph>> = {
  "SA-036": {
    asset: {
      id: "ndpr-plant",
      name: "NdPr alloy plant",
      role: "Magnet alloy production",
      place: "Baotou, China",
      lon: 109.8,
      lat: 40.6,
    },
    downstream: [
      {
        id: "ndpr-magnets",
        name: "Sintered magnet works",
        role: "NdFeB magnets",
        place: "Ningbo, China",
        lon: 121.5,
        lat: 29.9,
        impact: "high",
      },
      {
        id: "ndpr-munitions",
        name: "Guided munitions line",
        role: "Actuator magnets",
        place: "Tucson, United States",
        lon: -110.9,
        lat: 32.2,
        impact: "high",
      },
      {
        id: "ndpr-motors",
        name: "EV motor plant",
        role: "Traction motors",
        place: "Braunschweig, Germany",
        lon: 10.5,
        lat: 52.3,
        impact: "low",
      },
    ],
    edges: [
      { from: "ndpr-plant", to: "ndpr-magnets" },
      { from: "ndpr-magnets", to: "ndpr-munitions" },
      { from: "ndpr-magnets", to: "ndpr-motors" },
    ],
    alternatives: [
      {
        id: "ndpr-alt-1",
        rank: 1,
        name: "Mount Weld concentrate",
        country: "Australia",
        lon: 122.6,
        lat: -28.9,
        feedsNodeId: "ndpr-magnets",
      },
      {
        id: "ndpr-alt-2",
        rank: 2,
        name: "Mountain Pass oxide",
        country: "United States",
        lon: -115.5,
        lat: 35.5,
        feedsNodeId: "ndpr-magnets",
      },
    ],
  },
};

export function graphForAlert(alertId: string): AlertGraph | undefined {
  return GRAPHS[alertId];
}

/** All plottable nodes of a graph (asset + downstream), keyed by id. */
export function nodesById(graph: AlertGraph): ReadonlyMap<string, GeoNode> {
  return new Map<string, GeoNode>(
    [graph.asset, ...graph.downstream].map((node) => [node.id, node]),
  );
}
