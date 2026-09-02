// Alert data model for the Strategic Alerts console. Placeholder seed data
// lives here until a real feed lands — edit ALERTS to change what the
// console shows.

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
  readonly domain: Domain;
  readonly subdomain: string;
  readonly severity: Severity;
  readonly confidence: Confidence;
  readonly source: AlertSource;
  /** Downstream systems at risk, most consequential first. */
  readonly affectedSystems: readonly string[];
}

export const ALERTS: readonly Alert[] = [
  {
    id: "SA-041",
    title: "Gallium export licensing halt cuts refined supply",
    domain: "Economic",
    subdomain: "Critical Minerals",
    severity: "critical",
    confidence: "HIGH",
    source: { kind: "Cable", name: "Embassy cable 26-0142" },
    affectedSystems: [
      "AESA radar modules",
      "5G base stations",
      "Power electronics",
    ],
  },
  {
    id: "SA-038",
    title: "Cobalt rail corridor closure strands mined output",
    domain: "Economic",
    subdomain: "Critical Minerals",
    severity: "critical",
    confidence: "MEDIUM",
    source: { kind: "API", name: "Logistics feed" },
    affectedSystems: ["Turbine superalloys", "EV battery cathodes"],
  },
  {
    id: "SA-036",
    title: "NdPr magnet alloy plant fire curtails output",
    domain: "Economic",
    subdomain: "Critical Minerals",
    severity: "high",
    confidence: "HIGH",
    source: { kind: "Website", name: "Provincial press release" },
    affectedSystems: [
      "Precision-guided munitions",
      "Wind turbines",
      "EV motors",
    ],
  },
  {
    id: "SA-033",
    title: "Anode-grade graphite export quota tightened",
    domain: "Economic",
    subdomain: "Critical Minerals",
    severity: "high",
    confidence: "MEDIUM",
    source: { kind: "Website", name: "Ministry of Commerce notice" },
    affectedSystems: ["Battery anodes", "Grid storage"],
  },
  {
    id: "SA-029",
    title: "Lithium brine expansion delayed by permit dispute",
    domain: "Economic",
    subdomain: "Critical Minerals",
    severity: "elevated",
    confidence: "LOW",
    source: { kind: "Report", name: "Industry analyst note" },
    affectedSystems: ["EV battery cells", "Consumer electronics"],
  },
  {
    id: "SA-027",
    title: "Class 1 nickel refinery maintenance overrun",
    domain: "Economic",
    subdomain: "Critical Minerals",
    severity: "moderate",
    confidence: "MEDIUM",
    source: { kind: "API", name: "Commodities data feed" },
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
