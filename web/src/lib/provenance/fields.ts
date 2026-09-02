/**
 * Pure transform: a graph node -> ordered display rows for the Evidence panel.
 *
 * Every Attested field keeps its provenance so the panel can cite it.
 * Attested-capable fields that are null become "not attested"; plain
 * optional descriptive fields are omitted when absent.
 */
import type { GraphNode, Provenance } from "@/lib/api/types";

export interface FieldRow {
  label: string;
  value: string;
  provenance: Provenance | null;
}

export const NOT_ATTESTED = "not attested";

type ResolveName = (id: string) => string;

export function fieldRowsFor(node: GraphNode, resolveName: ResolveName): FieldRow[] {
  switch (node.kind) {
    case "deposit":
      return depositRows(node.entity, resolveName);
    case "project":
      return projectRows(node.entity, resolveName);
    case "facility":
      return facilityRows(node.entity, resolveName);
    case "organization":
      return organizationRows(node.entity, resolveName);
    case "material":
      return [
        row("Category", pretty(node.entity.category)),
        row("Elements", node.entity.elements.join(", ") || "—"),
        row("Unit", node.entity.unit),
      ];
    case "component":
      return [
        row("Category", node.entity.category),
        row("Defence relevant", node.entity.defense_relevant ? "yes" : "no"),
        ...node.entity.requires.map((required) =>
          row("Requires", resolveName(required.value), required.provenance),
        ),
      ];
    case "system":
      return [
        row("Category", node.entity.category),
        ...optional("Operator", node.entity.operator),
        ...node.entity.requires.map((required) =>
          row("Requires", resolveName(required.value), required.provenance),
        ),
      ];
  }
}

type Entity<K extends GraphNode["kind"]> = Extract<GraphNode, { kind: K }>["entity"];

function depositRows(deposit: Entity<"deposit">, resolveName: ResolveName): FieldRow[] {
  return [
    row("Country", resolveName(deposit.country_id)),
    ...optional("Deposit type", deposit.deposit_type),
    row("Commodities", deposit.commodities.join(", ")),
    deposit.coordinates
      ? row("Coordinates", coordinates(deposit.coordinates.value), deposit.coordinates.provenance)
      : row("Coordinates", NOT_ATTESTED),
    ...optional("Location", deposit.location_description),
    ...deposit.resource_estimates.map(estimateRow),
    ...aliasRows(deposit.aliases),
  ];
}

function projectRows(project: Entity<"project">, resolveName: ResolveName): FieldRow[] {
  return [
    row("Country", resolveName(project.country_id)),
    row("Development stage", pretty(project.development_stage.value), project.development_stage.provenance),
    row("Operating status", pretty(project.operating_status.value), project.operating_status.provenance),
    ...optional("Develops deposit", project.deposit_id, resolveName),
    ...optional("Operator", project.operator_id, resolveName),
    project.expected_production_start
      ? row(
          "Expected production start",
          String(project.expected_production_start.value),
          project.expected_production_start.provenance,
        )
      : row("Expected production start", NOT_ATTESTED),
    ...project.planned_production.map((figure) =>
      row(
        "Planned production",
        `${tonnes(figure.value.tonnes)} t ${pretty(figure.value.period)} of ${resolveName(figure.value.material_id)}${
          figure.value.target_year ? ` by ${figure.value.target_year}` : ""
        }${figure.value.note ? ` — ${figure.value.note}` : ""}`,
        figure.provenance,
      ),
    ),
    ...project.resource_estimates.map(estimateRow),
    ...aliasRows(project.aliases),
  ];
}

function facilityRows(facility: Entity<"facility">, resolveName: ResolveName): FieldRow[] {
  return [
    row("Country", resolveName(facility.country_id)),
    row("Facility type", pretty(facility.facility_type)),
    row("Operating status", pretty(facility.operating_status.value), facility.operating_status.provenance),
    ...optional("Operator", facility.operator_id, resolveName),
    facility.expected_start
      ? row("Expected start", String(facility.expected_start.value), facility.expected_start.provenance)
      : row("Expected start", NOT_ATTESTED),
    facility.coordinates
      ? row("Coordinates", coordinates(facility.coordinates.value), facility.coordinates.provenance)
      : row("Coordinates", NOT_ATTESTED),
    ...optional("Location", facility.location_description),
    ...facility.capacities.map((capacity) =>
      row(
        "Capacity",
        `${tonnes(capacity.value.tonnes_per_year)} t/y of ${resolveName(capacity.value.material_id)}`,
        capacity.provenance,
      ),
    ),
    ...listRow("Inputs", facility.input_material_ids, resolveName),
    ...listRow("Outputs", facility.output_material_ids, resolveName),
    ...aliasRows(facility.aliases),
  ];
}

function organizationRows(organization: Entity<"organization">, resolveName: ResolveName): FieldRow[] {
  return [
    row("Type", pretty(organization.organization_type)),
    ...optional("Headquarters", organization.headquarters_country_id, resolveName),
    ...optional("Parent organization", organization.parent_organization_id, resolveName),
    ...optional("Listing", organization.listing),
    organization.government_affiliation
      ? row(
          "Government affiliation",
          organization.government_affiliation.value,
          organization.government_affiliation.provenance,
        )
      : row("Government affiliation", NOT_ATTESTED),
    ...aliasRows(organization.aliases),
  ];
}

interface EstimateLike {
  classification: string;
  ore_tonnes: number;
  grade_pct: number | null;
  grade_basis: string | null;
  contained_tonnes: number | null;
  provenance: Provenance;
}

function estimateRow(estimate: EstimateLike): FieldRow {
  const grade = estimate.grade_pct !== null ? ` @ ${estimate.grade_pct}% ${estimate.grade_basis ?? ""}`.trimEnd() : "";
  const contained =
    estimate.contained_tonnes !== null ? ` (${tonnes(estimate.contained_tonnes)} t contained)` : "";
  return row(
    `${pretty(estimate.classification)} resource`,
    `${tonnes(estimate.ore_tonnes)} t ore${grade}${contained}`,
    estimate.provenance,
  );
}

function row(label: string, value: string, provenance: Provenance | null = null): FieldRow {
  return { label, value, provenance };
}

function optional(label: string, value: string | null, resolveName?: ResolveName): FieldRow[] {
  if (!value) return [];
  return [row(label, resolveName ? resolveName(value) : value)];
}

function listRow(label: string, ids: readonly string[], resolveName: ResolveName): FieldRow[] {
  if (ids.length === 0) return [];
  return [row(label, ids.map(resolveName).join(", "))];
}

function aliasRows(aliases: readonly string[]): FieldRow[] {
  if (aliases.length === 0) return [];
  return [row("Aliases", aliases.join(", "))];
}

function coordinates(value: { latitude: number; longitude: number }): string {
  return `${value.latitude}, ${value.longitude}`;
}

function tonnes(value: number): string {
  return value.toLocaleString("en-US");
}

export function pretty(value: string): string {
  return value.toLowerCase().replaceAll("_", " ");
}
