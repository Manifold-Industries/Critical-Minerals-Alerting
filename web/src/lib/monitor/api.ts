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
  /** Resolve against `AssetDetail.sources`. Null on a judgment, an inference or
   *  a model estimate — assertions that rest on no document. */
  readonly source_id: string | null;
  /** Confidence in this conclusion. Not `SourceRef.source_confidence`, which
   *  rates the document; a confident reading of a weak source is not a strong
   *  claim, and showing one for the other says it is. */
  readonly assertion_confidence: string | null;
  /** True where a model pulled the value out of the source and nobody has
   *  checked it. Rendering a citation without this implies a verification that
   *  has not happened. */
  readonly unverified_model_extraction: boolean;
}

export interface ApiFeedQuantity {
  readonly tonnes: number;
  readonly basis: string;
  readonly is_annual_rate: boolean;
  readonly provenance: ApiProvenance;
  readonly caveats: readonly string[];
}

export interface ApiFactorScore {
  readonly factor: string;
  readonly raw: number | null;
  readonly raw_label: string;
  /** [0, 1], 1 is best, on every factor. */
  readonly normalized: number;
  readonly weight: number;
  /** Points of the score. These sum to `ApiCandidateScore.value`. */
  readonly contribution: number;
  readonly max_contribution: number;
  /** False where a fallback stood in for data the graph does not hold. */
  readonly known: boolean;
  readonly detail: string | null;
  readonly excluded: boolean;
}

export interface ApiCandidateScore {
  /** 0-100, higher is better. */
  readonly value: number;
  readonly factors: readonly ApiFactorScore[];
  readonly policy_version: string;
}

export interface ApiScoringPolicy {
  readonly version: string;
  readonly weights: Readonly<Record<string, number>>;
  readonly excluded_factors: readonly string[];
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
  /** The composite this row was ranked on, and the factors behind it. */
  readonly score: ApiCandidateScore;
  /** The factor that gave away the most points, or — where `decisive_basis` is
   *  TIEBREAK — the RankingKey field that separated two equal scores. */
  readonly decisive_factor: string | null;
  readonly decisive_basis: string | null;
  /** Points the decisive factor was worth, on SCORE only. */
  readonly decisive_margin: number | null;
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

/**
 * Year every simulation is struck at, absent a reason to move off it.
 *
 * Not cosmetic: capacities are staged and supersede one another, so a
 * share-of-nameplate figure moves with this. It is exported because the console
 * has to raise it for a mine that does not open until later, and because the
 * figures it produces are only readable beside the year they were struck at —
 * `capacity_context.as_of_year` carries that back for display.
 *
 * The API applies the same default server-side; `/disruption/years` reports the
 * band over which the graph returns different answers, and is worth fetching
 * again if a year control ever returns.
 */
export const DEFAULT_IMPACT_YEAR = 2027;

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
  /** First year the mine is expected to produce; null if already producing
   *  or if no start year is disclosed — which are different things. */
  readonly earliest_year: number | null;
  /** True when as_of_year precedes the mine's own expected production start. */
  readonly before_production_start: boolean;
  readonly severity: number;
  readonly lost_feed: ApiFeedQuantity | null;
  readonly impacted: readonly ApiFacilityImpact[];
  readonly capacity_context: ApiCapacityContext | null;
  /** The weights every score in `impacted` was computed under. */
  readonly scoring: ApiScoringPolicy;
  readonly warnings: readonly string[];
}

export async function fetchDisruption(
  mineId: string,
  options: { readonly asOfYear?: number; readonly signal?: AbortSignal } = {},
): Promise<DisruptionResponse> {
  const { asOfYear = DEFAULT_IMPACT_YEAR, signal } = options;
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
  readonly earliest_year: number | null;
  readonly coordinates: ApiCoordinates | null;
  readonly reaches_refiner: boolean;
}

/** Mines the engine can simulate. Used for the globe's context-mode markers. */
export async function fetchMines(
  options: { readonly asOfYear?: number; readonly signal?: AbortSignal } = {},
): Promise<readonly ApiMineSummary[]> {
  const { asOfYear = DEFAULT_IMPACT_YEAR, signal } = options;
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
  // each plant is preserved. Scores are on one scale across plants, so they
  // could be re-sorted here — they are not, because the engine breaks exact ties
  // on a key that is not serialised, and re-sorting would drop it.
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
        score: alt.score.value,
        scoreFactors: alt.score.factors.map((f) => ({
          factor: f.factor,
          label: f.raw_label,
          contribution: f.contribution,
          maxContribution: f.max_contribution,
          known: f.known,
          detail: f.detail,
        })),
        decisiveFactor: pairingHolds ? alt.decisive_factor : null,
        decisiveBasis: pairingHolds ? alt.decisive_basis : null,
        decisiveMargin: pairingHolds ? alt.decisive_margin : null,
        tiedWithPrevious: pairingHolds && alt.tied_with_previous,
      });
    }
  }

  return {
    capacity: res.capacity_context ?? undefined,
    scoring: {
      version: res.scoring.version,
      weights: res.scoring.weights,
      excludedFactors: res.scoring.excluded_factors,
    },
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

// ── Per-asset reference detail ─────────────────────────────────────────────

export interface ApiMaterialFigure {
  readonly material_id: string;
  readonly material_name: string | null;
  readonly elements: readonly string[];
  readonly tonnes: number;
  readonly period: string | null;
  readonly target_year: number | null;
  /** Non-null means a later entry has replaced this one; do not sum it. */
  readonly superseded_by: number | null;
  readonly note: string | null;
  readonly provenance: ApiProvenance;
}

export interface ApiFeedSpec {
  readonly material_id: string;
  readonly material_name: string | null;
  readonly accepted_hosts: readonly string[];
  readonly note: string | null;
  readonly provenance: ApiProvenance;
}

export interface ApiProductForm {
  readonly material_id: string;
  readonly material_name: string | null;
  readonly host_mineral: string;
  readonly grade_pct_treo: number | null;
  readonly note: string | null;
  readonly provenance: ApiProvenance;
}

export interface ApiLinkedAsset {
  readonly id: string | null;
  readonly name: string | null;
  readonly relationship_id: string;
  readonly type: string;
  readonly status: string;
  readonly inferred: boolean;
  readonly qualification: string | null;
  readonly note: string | null;
  readonly provenance: ApiProvenance;
}

/** A document something in the response rests on. */
export interface ApiSourceRef {
  readonly id: string;
  readonly name: string;
  readonly source_type: string;
  readonly publisher: string | null;
  readonly published_on: string | null;
  /** Null on an unanchored source — render the name as text, never as a link. */
  readonly url: string | null;
  /** Page, table or section. What makes a 200-page report checkable. */
  readonly locator: string | null;
  /** Confidence in the document itself. See `ApiProvenance.assertion_confidence`. */
  readonly source_confidence: string | null;
}

export interface ApiDepositSummary {
  readonly id: string;
  readonly name: string;
  readonly deposit_type: string | null;
  readonly commodities: readonly string[];
  readonly location_description: string | null;
}

export interface AssetDetail {
  readonly id: string;
  readonly kind: "MINE" | "FACILITY";
  readonly name: string;
  readonly country_id: string | null;
  readonly country_name: string | null;
  readonly coordinates: ApiCoordinates | null;
  readonly operating_status: string;
  readonly operating_status_provenance: ApiProvenance | null;
  readonly development_stage: string | null;
  readonly development_stage_provenance: ApiProvenance | null;
  readonly facility_type: string | null;
  readonly expected_start: number | null;
  readonly expected_start_provenance: ApiProvenance | null;
  readonly operator_id: string | null;
  readonly operator_name: string | null;
  readonly deposit: ApiDepositSummary | null;
  readonly figures: readonly ApiMaterialFigure[];
  readonly accepted_feeds: readonly ApiFeedSpec[];
  readonly products: readonly ApiProductForm[];
  readonly supplied_by: readonly ApiLinkedAsset[];
  readonly supplies_to: readonly ApiLinkedAsset[];
  readonly is_dytb_refiner: boolean;
  readonly location_description: string | null;
  readonly description: string | null;
  readonly aliases: readonly string[];
  /** Documents cited above, in order of first citation. That order is what ties
   *  a row to its entry, so it must not be re-sorted. */
  readonly sources: readonly ApiSourceRef[];
}

/** Reference detail for one mine or plant. Rejects with 404 for a fixture id. */
export async function fetchAsset(
  assetId: string,
  options: { readonly signal?: AbortSignal } = {},
): Promise<AssetDetail> {
  const res = await fetch(`${BASE}/assets/${assetId}`, { signal: options.signal });
  if (!res.ok) throw new Error(`Asset request failed for ${assetId}: ${res.status}`);
  return (await res.json()) as AssetDetail;
}

// ── End-use exposure ───────────────────────────────────────────────────────
//
// Which weapons systems a mine's Dy/Tb reaches, and through which components.
// Every edge behind this is an open-source claim that a platform *class* uses a
// component *class* — bills of material are classified. It is not a routed
// path: nothing here checks the mine's Dy actually reaches a separator, which
// is what `fetchDisruption` answers. Read it as "what is at stake in this
// element", and keep `kind` visible so a category never reads as an airframe.

export interface ApiMaterialLink {
  readonly material_id: string;
  readonly material_name: string | null;
  readonly elements: readonly string[];
  /** The scoped subset that actually made the link — not `elements`. */
  readonly matched_elements: readonly string[];
  readonly provenance: ApiProvenance | null;
}

export interface ApiMineMaterial extends ApiMaterialLink {
  /** False means a contained-element figure, not a form the mine ships. */
  readonly shipped: boolean;
}

export interface ApiComponentExposure {
  readonly component_id: string;
  readonly name: string;
  readonly category: string;
  readonly defense_relevant: boolean;
  readonly elements: readonly string[];
  readonly via_materials: readonly ApiMaterialLink[];
  readonly platform_ids: readonly string[];
}

export interface ApiComponentLink {
  readonly component_id: string;
  readonly name: string;
  readonly defense_relevant: boolean;
  readonly provenance: ApiProvenance;
}

export interface ApiPlatformExposure {
  readonly platform_id: string;
  readonly name: string;
  readonly category: string;
  /** PLATFORM, SUBSYSTEM or CATEGORY. A CATEGORY names no single hull. */
  readonly kind: string;
  readonly parent_id: string | null;
  readonly parent_name: string | null;
  readonly via_components: readonly ApiComponentLink[];
  readonly elements: readonly string[];
  /** Weakest link on the best path — not a joint probability. Each edge is
   *  graded at the weaker of its own assertion confidence and the confidence
   *  of the document it cites, so a confident reading of a weak source does
   *  not reach this list as a strong claim. */
  readonly confidence: string | null;
  readonly defense_relevant: boolean;
}

export interface MineExposure {
  readonly mine_id: string;
  readonly mine_name: string | null;
  readonly scope_elements: readonly string[];
  readonly elements: readonly string[];
  readonly source_materials: readonly ApiMineMaterial[];
  readonly components: readonly ApiComponentExposure[];
  /** Most specific and best evidenced first. Server-ordered; do not re-sort. */
  readonly platforms: readonly ApiPlatformExposure[];
  /** Documents cited above, in order of first citation. Resolve a provenance's
   *  `source_id` against this — a bare id is not attribution. */
  readonly sources: readonly ApiSourceRef[];
  readonly warnings: readonly string[];
}

/** End uses reachable from one mine's Dy/Tb. No year: nothing here is staged. */
export async function fetchExposure(
  mineId: string,
  options: { readonly signal?: AbortSignal } = {},
): Promise<MineExposure> {
  const res = await fetch(`${BASE}/exposure/${mineId}`, { signal: options.signal });
  if (!res.ok) throw new Error(`Exposure request failed for ${mineId}: ${res.status}`);
  return (await res.json()) as MineExposure;
}
