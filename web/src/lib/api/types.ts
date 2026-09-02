/** Inferred TypeScript types for the API wire format. */
import type { z } from "zod";
import type {
  componentSchema,
  countrySchema,
  depositSchema,
  facilitySchema,
  graphDataSchema,
  graphEdgeSchema,
  graphNodeSchema,
  materialSchema,
  organizationSchema,
  projectSchema,
  provenanceSchema,
  sourceSchema,
  systemSchema,
} from "@/lib/api/schemas";

export type Provenance = z.infer<typeof provenanceSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Country = z.infer<typeof countrySchema>;
export type Deposit = z.infer<typeof depositSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Facility = z.infer<typeof facilitySchema>;
export type Material = z.infer<typeof materialSchema>;
export type Component = z.infer<typeof componentSchema>;
export type System = z.infer<typeof systemSchema>;
export type GraphNode = z.infer<typeof graphNodeSchema>;
export type GraphEdge = z.infer<typeof graphEdgeSchema>;
export type GraphData = z.infer<typeof graphDataSchema>;

export type NodeKind = GraphNode["kind"];
export type EdgeStatus = GraphEdge["status"];
export type EdgeType = GraphEdge["type"];
export type Confidence = NonNullable<Provenance["assertion_confidence"]>;
