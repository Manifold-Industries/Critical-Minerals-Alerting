// Geographic dependency graphs backing the globe, one per alert id.
// Placeholder seed data — edit GRAPHS to change what the globe shows.

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
}

export interface DependencyEdge {
  readonly from: string;
  readonly to: string;
  /** Transport routes render dashed. */
  readonly transport?: boolean;
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
}

export interface AlertGraph {
  readonly asset: GeoNode;
  readonly downstream: readonly DownstreamNode[];
  readonly edges: readonly DependencyEdge[];
  readonly alternatives: readonly AlternativeSource[];
}

export const GRAPHS: Readonly<Record<string, AlertGraph>> = {
  "SA-047": {
    asset: {
      id: "proj-mount-weld",
      name: "Mt Weld Mine and Concentration Plant",
      role: "Heavy rare earth mine",
      place: "Laverton, Australia",
      lon: 122.547,
      lat: -28.862,
    },
    downstream: [
      {
        id: "fac-lynas-kalgoorlie",
        name: "Kalgoorlie Rare Earths Processing Facility",
        role: "Cracking and leaching",
        place: "Kalgoorlie, Australia",
        lon: 121.409,
        lat: -30.788,
        impact: "high",
      },
      {
        id: "fac-lynas-malaysia",
        name: "Lynas Malaysia Advanced Materials Plant",
        role: "Dy/Tb separation",
        place: "Gebeng, Malaysia",
        lon: 103.377,
        lat: 4.004,
        impact: "high",
      }
    ],
    edges: [
      { from: "proj-mount-weld", to: "fac-lynas-kalgoorlie" },
      { from: "fac-lynas-kalgoorlie", to: "fac-lynas-malaysia" }
    ],
    alternatives: [
      {
        id: "proj-mountain-pass",
        rank: 1,
        name: "Mountain Pass Rare Earth Mine",
        country: "United States",
        lon: -115.532,
        lat: 35.482,
        feedsNodeId: "fac-lynas-malaysia",
      },
      {
        id: "proj-round-top",
        rank: 2,
        name: "Round Top Project",
        country: "United States",
        lon: -105.474,
        lat: 31.277,
        feedsNodeId: "fac-lynas-malaysia",
      },
      {
        id: "proj-fingerboards",
        rank: 3,
        name: "Fingerboards Critical Minerals Project",
        country: "Australia",
        lon: 147.332,
        lat: -37.804,
        feedsNodeId: "fac-lynas-malaysia",
      }
    ],
  },
  "SA-045": {
    asset: {
      id: "proj-mountain-pass",
      name: "Mountain Pass Rare Earth Mine",
      role: "Heavy rare earth mine",
      place: "Mountain Pass, United States",
      lon: -115.532,
      lat: 35.482,
    },
    downstream: [
      {
        id: "fac-mountain-pass-refinery",
        name: "Mountain Pass Refinery and Separation Complex",
        role: "Integrated refining",
        place: "Mountain Pass, United States",
        lon: -115.532,
        lat: 35.482,
        impact: "high",
      }
    ],
    edges: [
      { from: "proj-mountain-pass", to: "fac-mountain-pass-refinery" }
    ],
    alternatives: [
      {
        id: "proj-caldeira",
        rank: 1,
        name: "Caldeira Project",
        country: "Brazil",
        lon: -46.489,
        lat: -21.986,
        feedsNodeId: "fac-mountain-pass-refinery",
      },
      {
        id: "proj-serra-verde",
        rank: 2,
        name: "Serra Verde Pela Ema Operation",
        country: "Brazil",
        lon: -48.471,
        lat: -13.514,
        feedsNodeId: "fac-mountain-pass-refinery",
      },
      {
        id: "fac-sareco",
        rank: 3,
        name: "SARECO / Summit Atom Rare Earth Company (Stepnogorsk)",
        country: "Kazakhstan",
        lon: 71.883,
        lat: 52.342,
        feedsNodeId: "fac-mountain-pass-refinery",
      }
    ],
  },
  "SA-043": {
    asset: {
      id: "proj-caldeira",
      name: "Caldeira Project",
      role: "Heavy rare earth mine",
      place: "Pocos de Caldas, Brazil",
      lon: -46.489,
      lat: -21.986,
    },
    downstream: [
      {
        id: "fac-neo-silmet",
        name: "Neo Silmet Rare Earth Separation Facility",
        role: "Dy/Tb separation",
        place: "Sillamae, Estonia",
        lon: 27.745,
        lat: 59.401,
        impact: "medium",
      },
      {
        id: "fac-ucore-louisiana",
        name: "Ucore Strategic Metals Complex",
        role: "Dy/Tb separation",
        place: "Alexandria, United States",
        lon: -92.529,
        lat: 31.342,
        impact: "high",
      }
    ],
    edges: [
      { from: "proj-caldeira", to: "fac-neo-silmet" },
      { from: "proj-caldeira", to: "fac-ucore-louisiana" }
    ],
    alternatives: [
      {
        id: "proj-serra-verde",
        rank: 1,
        name: "Serra Verde Pela Ema Operation",
        country: "Brazil",
        lon: -48.471,
        lat: -13.514,
        feedsNodeId: "fac-neo-silmet",
      },
      {
        id: "proj-colossus",
        rank: 2,
        name: "Colossus Rare Earth Project",
        country: "Brazil",
        lon: -46.515,
        lat: -21.883,
        feedsNodeId: "fac-neo-silmet",
      },
      {
        id: "proj-penco",
        rank: 3,
        name: "Penco Module",
        country: "Chile",
        lon: -72.948,
        lat: -36.743,
        feedsNodeId: "fac-neo-silmet",
      },
      {
        id: "fac-sareco",
        rank: 4,
        name: "SARECO / Summit Atom Rare Earth Company (Stepnogorsk)",
        country: "Kazakhstan",
        lon: 71.883,
        lat: 52.342,
        feedsNodeId: "fac-ucore-louisiana",
      },
      {
        id: "proj-browns-range",
        rank: 5,
        name: "Browns Range Heavy Rare Earths Project",
        country: "Australia",
        lon: 128.94,
        lat: -18.86,
        feedsNodeId: "fac-ucore-louisiana",
      },
      {
        id: "proj-lofdal",
        rank: 6,
        name: "Lofdal Heavy Rare Earths Project",
        country: "Namibia",
        lon: 14.75,
        lat: -20.35,
        feedsNodeId: "fac-ucore-louisiana",
      }
    ],
  },
  "SA-041": {
    asset: {
      id: "ga-refinery",
      name: "Zhanjiang Ga refinery",
      role: "Primary gallium refining",
      place: "Guangdong, China",
      lon: 110.4,
      lat: 21.2,
    },
    downstream: [
      {
        id: "ga-radar-fab",
        name: "AESA module fab",
        role: "Radar T/R modules",
        place: "Andover, United States",
        lon: -71.1,
        lat: 42.7,
        impact: "high",
      },
      {
        id: "ga-basestation",
        name: "5G base station plant",
        role: "GaN power amplifiers",
        place: "Stockholm, Sweden",
        lon: 18.1,
        lat: 59.3,
        impact: "medium",
      },
      {
        id: "ga-power",
        name: "Power electronics line",
        role: "GaN devices",
        place: "Nagoya, Japan",
        lon: 136.9,
        lat: 35.2,
        impact: "medium",
      },
    ],
    edges: [
      { from: "ga-refinery", to: "ga-radar-fab" },
      { from: "ga-refinery", to: "ga-basestation" },
      { from: "ga-refinery", to: "ga-power" },
    ],
    alternatives: [
      {
        id: "ga-alt-1",
        rank: 1,
        name: "Rio Tinto Ga circuit",
        country: "Canada",
        lon: -71.2,
        lat: 48.4,
        feedsNodeId: "ga-radar-fab",
      },
      {
        id: "ga-alt-2",
        rank: 2,
        name: "Ingal recovery line",
        country: "Germany",
        lon: 6.9,
        lat: 51.2,
        feedsNodeId: "ga-basestation",
      },
    ],
  },
  "SA-038": {
    asset: {
      id: "co-corridor",
      name: "Lobito rail corridor",
      role: "Cobalt export corridor",
      place: "Benguela, Angola",
      lon: 13.5,
      lat: -12.4,
    },
    downstream: [
      {
        id: "co-refinery",
        name: "Cobalt refinery",
        role: "Sulfate refining",
        place: "Quzhou, China",
        lon: 118.9,
        lat: 28.9,
        impact: "high",
      },
      {
        id: "co-superalloy",
        name: "Superalloy foundry",
        role: "Turbine blade castings",
        place: "Muskegon, United States",
        lon: -86.2,
        lat: 43.2,
        impact: "medium",
      },
      {
        id: "co-cathode",
        name: "EV cathode line",
        role: "NMC precursor",
        place: "Gunsan, South Korea",
        lon: 126.7,
        lat: 35.9,
        impact: "medium",
      },
    ],
    edges: [
      { from: "co-corridor", to: "co-refinery", transport: true },
      { from: "co-refinery", to: "co-superalloy" },
      { from: "co-refinery", to: "co-cathode" },
    ],
    alternatives: [
      {
        id: "co-alt-1",
        rank: 1,
        name: "Durban port reroute",
        country: "South Africa",
        lon: 31.0,
        lat: -29.9,
        feedsNodeId: "co-refinery",
      },
      {
        id: "co-alt-2",
        rank: 2,
        name: "Dar es Salaam corridor",
        country: "Tanzania",
        lon: 39.3,
        lat: -6.8,
        feedsNodeId: "co-refinery",
      },
    ],
  },
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
  "SA-033": {
    asset: {
      id: "gr-hub",
      name: "Anode graphite hub",
      role: "Spherical graphite supply",
      place: "Heilongjiang, China",
      lon: 127.5,
      lat: 45.3,
    },
    downstream: [
      {
        id: "gr-anode",
        name: "Anode plant",
        role: "Coated anode material",
        place: "Ulsan, South Korea",
        lon: 129.3,
        lat: 35.5,
        impact: "high",
      },
      {
        id: "gr-giga",
        name: "Cell gigafactory",
        role: "Battery cells",
        place: "Sparks, United States",
        lon: -119.4,
        lat: 39.5,
        impact: "medium",
      },
    ],
    edges: [
      { from: "gr-hub", to: "gr-anode" },
      { from: "gr-anode", to: "gr-giga", transport: true },
    ],
    alternatives: [
      {
        id: "gr-alt-1",
        rank: 1,
        name: "Balama graphite",
        country: "Mozambique",
        lon: 38.5,
        lat: -13.1,
        feedsNodeId: "gr-anode",
      },
      {
        id: "gr-alt-2",
        rank: 2,
        name: "Matawinie mine",
        country: "Canada",
        lon: -73.5,
        lat: 46.6,
        feedsNodeId: "gr-giga",
      },
    ],
  },
  "SA-029": {
    asset: {
      id: "li-brine",
      name: "Salar brine expansion",
      role: "Lithium brine extraction",
      place: "Atacama, Chile",
      lon: -68.2,
      lat: -23.5,
    },
    downstream: [
      {
        id: "li-conversion",
        name: "Conversion plant",
        role: "Lithium hydroxide",
        place: "Jiangsu, China",
        lon: 120.5,
        lat: 32.0,
        impact: "medium",
      },
      {
        id: "li-cells",
        name: "Cell plant",
        role: "EV battery cells",
        place: "Commerce, United States",
        lon: -83.2,
        lat: 33.9,
        impact: "low",
      },
    ],
    edges: [
      { from: "li-brine", to: "li-conversion", transport: true },
      { from: "li-conversion", to: "li-cells" },
    ],
    alternatives: [
      {
        id: "li-alt-1",
        rank: 1,
        name: "Greenbushes spodumene",
        country: "Australia",
        lon: 116.0,
        lat: -33.9,
        feedsNodeId: "li-conversion",
      },
      {
        id: "li-alt-2",
        rank: 2,
        name: "Thacker Pass",
        country: "United States",
        lon: -118.1,
        lat: 41.7,
        feedsNodeId: "li-cells",
      },
    ],
  },
  "SA-027": {
    asset: {
      id: "ni-refinery",
      name: "Class 1 nickel refinery",
      role: "Battery-grade nickel",
      place: "Harjavalta, Finland",
      lon: 22.1,
      lat: 61.3,
    },
    downstream: [
      {
        id: "ni-precursor",
        name: "Precursor plant",
        role: "Cathode precursor",
        place: "Kokkola, Finland",
        lon: 23.1,
        lat: 63.8,
        impact: "medium",
      },
      {
        id: "ni-stainless",
        name: "Stainless mill",
        role: "Specialty alloys",
        place: "Terni, Italy",
        lon: 12.6,
        lat: 42.6,
        impact: "low",
      },
    ],
    edges: [
      { from: "ni-refinery", to: "ni-precursor" },
      { from: "ni-refinery", to: "ni-stainless" },
    ],
    alternatives: [
      {
        id: "ni-alt-1",
        rank: 1,
        name: "Niihama refinery",
        country: "Japan",
        lon: 133.3,
        lat: 33.9,
        feedsNodeId: "ni-precursor",
      },
      {
        id: "ni-alt-2",
        rank: 2,
        name: "Ambatovy restart",
        country: "Madagascar",
        lon: 48.3,
        lat: -18.9,
        feedsNodeId: "ni-precursor",
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
