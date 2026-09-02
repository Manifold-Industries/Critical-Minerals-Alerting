// Client for the disruption API, plus the adapter onto the console's view model.
//
// The API returns the domain shape — what the engine decided and why — and
// deliberately carries no notion of "impact level", because the graph has none.
// Turning `soleSource` into a marker colour is a presentation call, so it is
// made here rather than on the server.

import type {
  AlertGraph,
  AlternativeSource,
  DownstreamNode,
  GeoNode,
  ImpactLevel,
} from "./graphs";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Alternatives per affected plant. The engine returns ~20; the rail shows a few. */
const ALTERNATIVES_PER_FACILITY = 4;

export interface ApiCoordinates {
  readonly lat: number;
  readonly lon: number;
}

export interface ApiProvenance {
  readonly type: string;
  readonly source_id: string | null;
  readonly assertion_confidence: string | null;
}

export interface ApiFeedQuantity {
  readonly tonnes: number;
  readonly basis: string;
  readonly is_annual_rate: boolean;
  readonly provenance: ApiProvenance;
  readonly caveats: readonly string[];
}

export interface ApiAlternativeFeed {
  readonly rank: number;
  readonly source_id: string;
  readonly name: string | null;
  readonly country_id: string | null;
  readonly country_name: string | null;
  readonly coordinates: ApiCoordinates | null;
  readonly relationship_id: string;
  /** 0 curated, 1 automated. The inferred layer describes itself as "not evidence". */
  readonly evidence_class: number;
  readonly qualification: string | null;
  readonly qualification_lead_months: number | null;
  readonly status: string;
  readonly alignment: string | null;
  readonly alignment_known: boolean;
  readonly available_feed: ApiFeedQuantity | null;
  readonly months_to_flow: number | null;
  readonly readiness_known: boolean;
  readonly basis_comparable: boolean;
  readonly already_committed_to: readonly string[];
  readonly note: string | null;
  readonly coverage: string;
  readonly covered_fraction: number | null;
  readonly decisive_factor: string | null;
  readonly tied_with_previous: boolean;
  readonly decisive_against: string | null;
}

export interface ApiPathNode {
  readonly id: string;
  readonly name: string | null;
  readonly facility_type: string | null;
  readonly operating_status: string | null;
  readonly country_id: string | null;
  readonly country_name: string | null;
  readonly coordinates: ApiCoordinates | null;
}

export interface ApiFacilityImpact {
  readonly facility_id: string;
  readonly name: string | null;
  readonly facility_type: string;
  readonly country_id: string | null;
  readonly country_name: string | null;
  readonly coordinates: ApiCoordinates | null;
  readonly hops: number;
  readonly via_relationship_ids: readonly string[];
  readonly path: readonly ApiPathNode[];
  readonly nameplate_dytb_tpa: number | null;
  readonly operating_status: string;
  readonly sole_source: boolean;
  readonly remaining_supplies_in: number;
  readonly share_of_nameplate: number | null;
  readonly share_of_modelled_capacity: number | null;
  readonly alternatives: readonly ApiAlternativeFeed[];
}

export interface ApiCapacityContext {
  readonly as_of_year: number;
  readonly total_tpa: number;
  readonly refiners_disclosing: number;
  readonly refiners_total: number;
  /** Null — never 0 — when no affected plant discloses a nameplate. */
  readonly affected_tpa: number | null;
  readonly affected_share: number | null;
  readonly undisclosed_facility_ids: readonly string[];
}

export interface DisruptionResponse {
  readonly mine_id: string;
  readonly mine_name: string | null;
  readonly country_id: string | null;
  readonly country_name: string | null;
  readonly coordinates: ApiCoordinates | null;
  readonly as_of_year: number;
  readonly severity: number;
  readonly lost_feed: ApiFeedQuantity | null;
  readonly impacted: readonly ApiFacilityImpact[];
  readonly capacity_context: ApiCapacityContext | null;
  readonly warnings: readonly string[];
}

export async function fetchDisruption(
  mineId: string,
  options: { readonly asOfYear?: number; readonly signal?: AbortSignal } = {},
): Promise<DisruptionResponse> {
  const { asOfYear = 2027, signal } = options;
  const params = new URLSearchParams({
    as_of_year: String(asOfYear),
    limit: String(ALTERNATIVES_PER_FACILITY),
  });
  const res = await fetch(`${BASE}/disruption/${mineId}?${params}`, { signal });
  if (!res.ok) {
    throw new Error(`Disruption request failed for ${mineId}: ${res.status}`);
  }
  return (await res.json()) as DisruptionResponse;
}

export interface ApiMineSummary {
  readonly mine_id: string;
  readonly name: string;
  readonly country_id: string;
  readonly country_name: string | null;
  readonly operating_status: string;
  readonly coordinates: ApiCoordinates | null;
  readonly reaches_refiner: boolean;
}

/** Mines the engine can simulate. Used for the globe's context-mode markers. */
export async function fetchMines(
  options: { readonly asOfYear?: number; readonly signal?: AbortSignal } = {},
): Promise<readonly ApiMineSummary[]> {
  const { asOfYear = 2027, signal } = options;
  const params = new URLSearchParams({
    as_of_year: String(asOfYear),
    reaches_refiner: "true",
  });
  const res = await fetch(`${BASE}/disruption/mines?${params}`, { signal });
  if (!res.ok) throw new Error(`Mines request failed: ${res.status}`);
  return (await res.json()) as readonly ApiMineSummary[];
}

/** Minimal node for a mine the globe draws but has not fetched a full graph for. */
export function toContextAsset(mine: ApiMineSummary): GeoNode | undefined {
  if (!mine.coordinates) return undefined;
  return {
    id: mine.mine_id,
    name: mine.name,
    role: "Heavy rare earth mine",
    place: mine.country_name ?? mine.country_id,
    lon: mine.coordinates.lon,
    lat: mine.coordinates.lat,
  };
}

const FACILITY_ROLE: Record<string, string> = {
  SEPARATION: "Dy/Tb separation",
  REFINERY: "Integrated refining",
  BENEFICIATION: "Cracking and leaching",
  METALLIZATION_AND_ALLOYING: "Metal and alloy",
  MAGNET_MANUFACTURING: "Magnet manufacturing",
  RECYCLING: "Recycling",
  OTHER: "Processing",
};

/**
 * A plant with no surviving supplier loses everything when the mine goes down;
 * one that keeps a supplier is degraded, not severed. The graph records the
 * facts (`sole_source`, `remaining_supplies_in`) and leaves the reading to us.
 */
function impactOf(facility: ApiFacilityImpact): ImpactLevel {
  return facility.sole_source ? "high" : "medium";
}

/** Adapts an API response onto the view model the globe and panel already read. */
export function toAlertGraph(res: DisruptionResponse): AlertGraph | undefined {
  if (!res.coordinates) return undefined;

  const downstream: DownstreamNode[] = [];
  const seen = new Set<string>([res.mine_id]);
  const edges: { from: string; to: string }[] = [];
  const edgeSeen = new Set<string>();

  for (const facility of res.impacted) {
    // Intermediates first: Mt Weld reaches Lynas Malaysia only through
    // Kalgoorlie, and a mine-to-plant straight line would hide that hop.
    for (const node of res.impacted.length ? facility.path : []) {
      if (node.id === res.mine_id || node.id === facility.facility_id) continue;
      if (seen.has(node.id) || !node.coordinates) continue;
      seen.add(node.id);
      downstream.push({
        id: node.id,
        name: node.name ?? node.id,
        // An intermediate is a real plant losing its own feed, so it is
        // described like any other node rather than as a waypoint.
        role: FACILITY_ROLE[node.facility_type ?? ""] ?? "Intermediate processing",
        place: node.country_name ?? "",
        lon: node.coordinates.lon,
        lat: node.coordinates.lat,
        impact: "high",
        // An intermediate fed only by the disrupted mine loses everything.
        soleSource: true,
        remainingSupplies: 0,
        operatingStatus: node.operating_status ?? undefined,
      });
    }
    if (!seen.has(facility.facility_id) && facility.coordinates) {
      seen.add(facility.facility_id);
      downstream.push({
        id: facility.facility_id,
        name: facility.name ?? facility.facility_id,
        role: FACILITY_ROLE[facility.facility_type] ?? "Processing",
        place: facility.country_name ?? "",
        lon: facility.coordinates.lon,
        lat: facility.coordinates.lat,
        impact: impactOf(facility),
        soleSource: facility.sole_source,
        remainingSupplies: facility.remaining_supplies_in,
        operatingStatus: facility.operating_status,
        shareOfNameplate: facility.share_of_nameplate ?? undefined,
        shareOfModelledCapacity: facility.share_of_modelled_capacity ?? undefined,
      });
    }
    for (let i = 0; i < facility.path.length - 1; i += 1) {
      const from = facility.path[i];
      const to = facility.path[i + 1];
      const key = `${from.id}->${to.id}`;
      if (edgeSeen.has(key) || !from.coordinates || !to.coordinates) continue;
      edgeSeen.add(key);
      edges.push({ from: from.id, to: to.id });
    }
  }

  // Rank is sequential across the whole panel, but the engine's ordering within
  // each plant is preserved — it is a lexicographic key, not a score to re-sort.
  const alternatives: AlternativeSource[] = [];
  const usedSources = new Set<string>();
  for (const facility of res.impacted) {
    for (const alt of facility.alternatives) {
      if (usedSources.has(alt.source_id) || !alt.coordinates) continue;
      usedSources.add(alt.source_id);
      // The API measured `decisive_factor` against a specific row. Dedupe and
      // the flattening of per-facility lists can both break that adjacency, and
      // showing "↓ slower to flow" beside a row it was not compared with states
      // a comparison nobody made. Keep it only where the pairing survived.
      const above = alternatives[alternatives.length - 1];
      const pairingHolds =
        alt.decisive_against != null && above?.id === alt.decisive_against;
      alternatives.push({
        id: alt.source_id,
        rank: alternatives.length + 1,
        name: alt.name ?? alt.source_id,
        country: alt.country_name ?? alt.country_id ?? "",
        lon: alt.coordinates.lon,
        lat: alt.coordinates.lat,
        feedsNodeId: facility.facility_id,
        evidenceClass: alt.evidence_class,
        decisiveFactor: pairingHolds ? alt.decisive_factor : null,
        tiedWithPrevious: pairingHolds && alt.tied_with_previous,
      });
    }
  }

  return {
    capacity: res.capacity_context ?? undefined,
    asset: {
      id: res.mine_id,
      name: res.mine_name ?? res.mine_id,
      role: "Heavy rare earth mine",
      place: res.country_name ?? "",
      lon: res.coordinates.lon,
      lat: res.coordinates.lat,
    },
    downstream,
    edges,
    alternatives,
  };
}

