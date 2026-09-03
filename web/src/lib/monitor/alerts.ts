// Alert data model for the Strategic Alerts console. Placeholder seed data
// lives here until a real feed lands — edit ALERTS to change what the
// console shows.
//
// Alerts carrying a `mineId` are half-derived: the narrative fields are seeded
// here, but the dependency graph and the affected systems are both read from
// the API, so neither can drift away from the supply graph they describe.

/** DIMEFIL instruments of national power. */
export type Domain =
  | "Diplomatic"
  | "Information"
  | "Military"
  | "Economic"
  | "Financial"
  | "Intelligence"
  | "Law Enforcement";

export type Severity = "critical" | "high" | "elevated" | "moderate";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

/** Where the alert originated. */
export type SourceKind = "Cable" | "Website" | "API" | "Report";

export interface AlertSource {
  readonly kind: SourceKind;
  /** Human-readable identifier, e.g. a cable number or site name. */
  readonly name: string;
}

export interface Alert {
  readonly id: string;
  readonly title: string;
  /** One-sentence qualitative account of what happened. */
  readonly summary: string;
  readonly domain: Domain;
  readonly subdomain: string;
  readonly severity: Severity;
  readonly confidence: Confidence;
  readonly source: AlertSource;
  /**
   * Critical minerals this alert is about, as element symbols where there is
   * one. Placeholder, and only for alerts with no engine behind them: an alert
   * carrying a `mineId` reads its elements from `/exposure/{mineId}` instead,
   * so what the queue shows follows the materials the mine actually puts into
   * the chain. Absent on those alerts precisely so a stale list cannot be shown.
   */
  readonly minerals?: readonly string[];
  /**
   * Downstream systems at risk, most consequential first. Placeholder prose,
   * and only for alerts with no engine behind them: an alert carrying a
   * `mineId` derives this from `/exposure/{mineId}` instead, so what it claims
   * follows the component and platform layers rather than going stale against
   * them. Absent on those alerts precisely so a stale list cannot be shown.
   */
  readonly affectedSystems?: readonly string[];
  /**
   * Project id to simulate, for alerts backed by the disruption engine.
   * Present means the console fetches its graph and its end-use exposure live;
   * absent means it falls back to the placeholder fixture in `graphs.ts`.
   */
  readonly mineId?: string;
}

export const ALERTS: readonly Alert[] = [
  {
    id: "SA-047",
    mineId: "proj-mount-weld",
    title: "Haul road washout halts Mt Weld concentrate to Kalgoorlie",
    summary:
      "Sustained flooding severed the haul route out of Mt Weld, suspending concentrate deliveries to the Kalgoorlie cracking and leaching plant and cutting the only feed reaching Lynas Malaysia's Dy/Tb separation circuit.",
    domain: "Economic",
    subdomain: "Critical Minerals",
    severity: "critical",
    confidence: "HIGH",
    source: { kind: "Cable", name: "Consulate cable 26-0311" },
  },
  {
    id: "SA-045",
    mineId: "proj-mountain-pass",
    title: "Mountain Pass mill fire cuts domestic heavy rare earth feed",
    summary:
      "A fire in the Mountain Pass concentrator has suspended mine output, leaving the co-located refinery and separation circuit without feed and removing the only domestic source of contained Dy/Tb.",
    domain: "Economic",
    subdomain: "Critical Minerals",
    severity: "critical",
    confidence: "MEDIUM",
    source: { kind: "Report", name: "Field office incident report" },
  },
  {
    id: "SA-043",
    mineId: "proj-caldeira",
    title: "Caldeira licence suspension halts ionic clay MREC exports",
    summary:
      "A state environmental court suspended operating licences at the Caldeira project, halting mixed rare earth carbonate shipments to separation plants in Estonia and Louisiana.",
    domain: "Economic",
    subdomain: "Critical Minerals",
    severity: "critical",
    confidence: "MEDIUM",
    source: { kind: "Website", name: "State environmental agency notice" },
  },
  {
    id: "SA-041",
    title: "Gallium export licensing halt cuts refined supply",
    summary:
      "Export licensing for refined gallium was halted at the primary refinery, constraining supply to downstream electronics producers.",
    domain: "Economic",
    subdomain: "Critical Minerals",
    severity: "critical",
    confidence: "HIGH",
    source: { kind: "Cable", name: "Embassy cable 26-0142" },
    minerals: ["Ga"],
    affectedSystems: [
      "AESA radar modules",
      "5G base stations",
      "Power electronics",
    ],
  },
  {
    id: "SA-038",
    title: "Cobalt rail corridor closure strands mined output",
    summary:
      "A closure of the Lobito rail corridor has stranded mined cobalt output inland, delaying export shipments to refiners.",
    domain: "Economic",
    subdomain: "Critical Minerals",
    severity: "critical",
    confidence: "MEDIUM",
    source: { kind: "API", name: "Logistics feed" },
    minerals: ["Co"],
    affectedSystems: ["Turbine superalloys", "EV battery cathodes"],
  },
  {
    id: "SA-036",
    title: "NdPr magnet alloy plant fire curtails output",
    summary:
      "A fire at the Baotou alloy plant curtailed NdPr magnet alloy output, leaving magnet producers facing feedstock shortfalls.",
    domain: "Economic",
    subdomain: "Critical Minerals",
    severity: "high",
    confidence: "HIGH",
    source: { kind: "Website", name: "Provincial press release" },
    minerals: ["Nd", "Pr"],
    affectedSystems: [
      "Precision-guided munitions",
      "Wind turbines",
      "EV motors",
    ],
  },
  {
    id: "SA-033",
    title: "Anode-grade graphite export quota tightened",
    summary:
      "Export quotas for anode-grade graphite were tightened, restricting feedstock available to battery anode producers.",
    domain: "Economic",
    subdomain: "Critical Minerals",
    severity: "high",
    confidence: "MEDIUM",
    source: { kind: "Website", name: "Ministry of Commerce notice" },
    minerals: ["Graphite"],
    affectedSystems: ["Battery anodes", "Grid storage"],
  },
  {
    id: "SA-029",
    title: "Lithium brine expansion delayed by permit dispute",
    summary:
      "A permitting dispute delayed the salar brine expansion, pushing back planned growth in lithium output.",
    domain: "Economic",
    subdomain: "Critical Minerals",
    severity: "elevated",
    confidence: "LOW",
    source: { kind: "Report", name: "Industry analyst note" },
    minerals: ["Li"],
    affectedSystems: ["EV battery cells", "Consumer electronics"],
  },
  {
    id: "SA-027",
    title: "Class 1 nickel refinery maintenance overrun",
    summary:
      "Scheduled maintenance at the class 1 nickel refinery overran, tightening battery-grade nickel availability.",
    domain: "Economic",
    subdomain: "Critical Minerals",
    severity: "moderate",
    confidence: "MEDIUM",
    source: { kind: "API", name: "Commodities data feed" },
    minerals: ["Ni"],
    affectedSystems: ["Stainless alloys", "Battery cathodes"],
  },
];

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  elevated: 2,
  moderate: 3,
};

/** Returns a new array sorted most severe first — never by recency. */
export function sortBySeverity(alerts: readonly Alert[]): readonly Alert[] {
  return [...alerts].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );
}
