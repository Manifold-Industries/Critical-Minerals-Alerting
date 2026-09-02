import type { Severity } from "./alerts";
import type { ImpactLevel } from "./graphs";

// Severity reads as a wash of color (queue cards) or node color (globe).
export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "#b91c1c",
  high: "#ff5d52",
  elevated: "#ffa028",
  moderate: "#ffd24d",
};

// Downstream impact levels on the globe share the severity family.
export const IMPACT_COLOR: Record<ImpactLevel, string> = {
  high: "#ff5d52",
  medium: "#ffa028",
  low: "#ffd24d",
};

/** Alternative / safe entities: hollow ring in the positive green. */
export const SAFE_COLOR = "#35d97b";
