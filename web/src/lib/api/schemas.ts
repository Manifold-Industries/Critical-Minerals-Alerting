/**
 * Zod schemas mirroring api/src/models one-to-one.
 *
 * The wire format equals the seed-file format (enums as string values,
 * dates as YYYY-MM-DD strings, Attested/Provenance as nested objects), so
 * these schemas describe both the API responses and api/src/data/*.json.
 */
import { z } from "zod";

export const confidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);

export const provenanceSchema = z.object({
  type: z.enum(["MEASURED", "REPORTED", "INFERRED", "JUDGMENT", "MODEL_ESTIMATE", "UNKNOWN"]),
  source_id: z.string().nullable(),
  assertion_confidence: confidenceSchema.nullable(),
  last_verified: z.string().nullable(),
});

const attested = <T extends z.ZodType>(value: T) =>
  z.object({ value, provenance: provenanceSchema });

export const sourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  source_type: z.enum(["DOCUMENT", "DATABASE", "TABLE", "CABLE", "NEWS", "API", "OTHER"]),
  publisher: z.string().nullable(),
  published_on: z.string().nullable(),
  // http(s) only — a javascript: URL in a source record must never become an href.
  url: z.url({ protocol: /^https?$/ }).nullable(),
  locator: z.string().nullable(),
  source_confidence: confidenceSchema.nullable(),
});

export const countrySchema = z.object({
  id: z.string(),
  name: z.string(),
  iso_alpha2: z.string(),
  iso_alpha3: z.string().nullable(),
  geometry_wkt: z.string().nullable(),
  alignment: attested(z.string()).nullable(),
  risk_score: attested(z.number()).nullable(),
});

const coordinatesSchema = z.object({ latitude: z.number(), longitude: z.number() });

const resourceEstimateSchema = z.object({
  classification: z.enum(["MEASURED", "INDICATED", "INFERRED", "PROVED", "PROBABLE"]),
  ore_tonnes: z.number(),
  provenance: provenanceSchema,
  grade_pct: z.number().nullable(),
  grade_basis: z.string().nullable(),
  contained_tonnes: z.number().nullable(),
});

export const depositSchema = z.object({
  id: z.string(),
  name: z.string(),
  country_id: z.string(),
  commodities: z.array(z.string()),
  coordinates: attested(coordinatesSchema).nullable(),
  geometry_wkt: z.string().nullable(),
  deposit_type: z.string().nullable(),
  resource_estimates: z.array(resourceEstimateSchema),
  location_description: z.string().nullable(),
  aliases: z.array(z.string()),
});

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  organization_type: z.enum(["COMPANY", "STATE_OWNED_ENTERPRISE", "GOVERNMENT", "INVESTOR", "OTHER"]),
  headquarters_country_id: z.string().nullable(),
  parent_organization_id: z.string().nullable(),
  listing: z.string().nullable(),
  government_affiliation: attested(z.string()).nullable(),
  aliases: z.array(z.string()),
});

const developmentStageSchema = z.enum([
  "EXPLORATION",
  "DEVELOPMENT",
  "FEASIBILITY",
  "PERMITTING",
  "CONSTRUCTION",
  "PRODUCTION",
  "CARE_AND_MAINTENANCE",
  "CLOSED",
]);

const operatingStatusSchema = z.enum([
  "PLANNED",
  "UNDER_CONSTRUCTION",
  "COMMISSIONING",
  "OPERATING",
  "SUSPENDED",
  "CLOSED",
]);

const productionFigureSchema = z.object({
  material_id: z.string(),
  tonnes: z.number(),
  period: z.enum(["ANNUAL", "LIFE_OF_MINE"]),
  target_year: z.number().nullable(),
  note: z.string().nullable(),
});

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  country_id: z.string(),
  development_stage: attested(developmentStageSchema),
  operating_status: attested(operatingStatusSchema),
  deposit_id: z.string().nullable(),
  operator_id: z.string().nullable(),
  expected_production_start: attested(z.number()).nullable(),
  planned_production: z.array(attested(productionFigureSchema)),
  resource_estimates: z.array(resourceEstimateSchema),
  description: z.string().nullable(),
  aliases: z.array(z.string()),
});

const capacitySchema = z.object({ material_id: z.string(), tonnes_per_year: z.number() });

export const facilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  facility_type: z.enum([
    "BENEFICIATION",
    "REFINERY",
    "SEPARATION",
    "METALLIZATION_AND_ALLOYING",
    "MAGNET_MANUFACTURING",
    "RECYCLING",
    "OTHER",
  ]),
  country_id: z.string(),
  operating_status: attested(operatingStatusSchema),
  operator_id: z.string().nullable(),
  location_description: z.string().nullable(),
  coordinates: attested(coordinatesSchema).nullable(),
  input_material_ids: z.array(z.string()),
  output_material_ids: z.array(z.string()),
  capacities: z.array(attested(capacitySchema)),
  expected_start: attested(z.number()).nullable(),
  description: z.string().nullable(),
  aliases: z.array(z.string()),
});

export const materialSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["ORE", "CONCENTRATE", "CARBONATE", "OXIDE", "METAL", "ALLOY", "MAGNET"]),
  elements: z.array(z.string()),
  unit: z.string(),
});

export const componentSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  requires: z.array(attested(z.string())),
  defense_relevant: z.boolean(),
});

export const systemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  requires: z.array(attested(z.string())),
  operator: z.string().nullable(),
});

const nodeOf = <K extends string, T extends z.ZodType>(kind: K, entity: T) =>
  z.object({ kind: z.literal(kind), id: z.string(), name: z.string(), entity });

export const graphNodeSchema = z.discriminatedUnion("kind", [
  nodeOf("deposit", depositSchema),
  nodeOf("organization", organizationSchema),
  nodeOf("project", projectSchema),
  nodeOf("facility", facilitySchema),
  nodeOf("material", materialSchema),
  nodeOf("component", componentSchema),
  nodeOf("system", systemSchema),
]);

export const graphEdgeSchema = z.object({
  id: z.string(),
  type: z.enum([
    "SUPPLIES",
    "INVESTED_IN",
    "ALTERNATIVE_TO",
    "DEVELOPS",
    "OPERATES",
    "SUBSIDIARY_OF",
    "PRODUCES",
    "REQUIRES",
  ]),
  from_id: z.string(),
  to_id: z.string().nullable(),
  status: z.enum(["OBSERVED", "CONTRACTED", "PLANNED", "POTENTIAL", "UNRESOLVED", "HISTORICAL"]),
  provenance: provenanceSchema.nullable(),
  material_ids: z.array(z.string()),
  annual_tonnes: z.number().nullable(),
  total_tonnes: z.number().nullable(),
  start_year: z.number().nullable(),
  end_year: z.number().nullable(),
  note: z.string().nullable(),
  derived: z.boolean(),
});

export const graphDataSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
  context: z.object({
    countries: z.array(countrySchema),
    sources: z.array(sourceSchema),
  }),
});

export const graphEnvelopeSchema = z.object({
  success: z.boolean(),
  data: graphDataSchema.nullable(),
  error: z.string().nullable(),
});
