// Weakest-link confidence for a single assertion, and the grade the GUI paints.
//
// Two confidences travel with every cited claim and the API is emphatic that
// they are not interchangeable: `assertion_confidence` rates the conclusion,
// `source_confidence` rates the document it was drawn from. A careful reading
// of a weak source is not a strong claim.
//
// So the grade is the weaker of the two rather than either alone. That is the
// same weakest-link rule `/exposure` already applies along a two-edge path, and
// for the same reason given there: the two ratings are not independent, and the
// graph carries nothing that would let them be combined into a joint
// probability. Taking the minimum is not collapsing them — both are still
// reported separately, and the hover card names which one set the grade.
//
// Grade labels follow ICD-203 confidence language: High / Moderate / Low
// confidence, with "Unrated" and "No claim" as distinct honest answers rather
// than points on the scale.

import type { ApiProvenance, ApiSourceRef } from "./api";

/** Five states. "Unrated" is a real answer and is not "high"; "No claim" is a
 *  field the graph asserts nothing about, which is different again. */
export type ConfidenceGrade = "HIGH" | "MEDIUM" | "LOW" | "UNRATED" | "NO_CLAIM";

const RANK: Record<ConfidenceGrade, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  UNRATED: 0,
  // Never enters the weakest-link minimum: a missing claim is not a weak one.
  NO_CLAIM: 0,
};

const BY_RANK: readonly ConfidenceGrade[] = ["UNRATED", "LOW", "MEDIUM", "HIGH"];

/** Anything the API did not rate, or rated with a value we do not know, is
 *  UNRATED. Guessing HIGH for an unrecognised string would invent a rating. */
export function toGrade(value: string | null | undefined): ConfidenceGrade {
  return value === "HIGH" || value === "MEDIUM" || value === "LOW"
    ? value
    : "UNRATED";
}

export interface DisplayedConfidence {
  /** What the dot paints: the weaker of the two inputs below. */
  readonly grade: ConfidenceGrade;
  readonly assertion: ConfidenceGrade;
  /** Null where the assertion rests on no document at all, which is different
   *  from resting on one nobody has rated. */
  readonly source: ConfidenceGrade | null;
  /** Which input the grade came from, so the card can say why it is what it
   *  is. BOTH where the two agree and neither alone is the constraint. */
  readonly binding: "ASSERTION" | "SOURCE" | "BOTH";
}

/**
 * The grade for one assertion, given the document it cites (where it cites one).
 *
 * An unrated *document* drags the grade to UNRATED rather than being skipped.
 * An unassessed source is not a weak one, but it is also not a warrant, and the
 * empty dot reads as "go rate this document" rather than as a verdict on it.
 * No row in the current data hits this: all 89 sources carry a rating.
 */
export function displayedConfidence(
  provenance: ApiProvenance,
  source: ApiSourceRef | null | undefined,
): DisplayedConfidence {
  const assertion = toGrade(provenance.assertion_confidence);
  // A provenance naming no source_id rests on no document by design — a
  // judgment, an inference, a model estimate. Only the assertion can grade it.
  if (!provenance.source_id || !source) {
    return { grade: assertion, assertion, source: null, binding: "ASSERTION" };
  }
  const sourceGrade = toGrade(source.source_confidence);
  const weakest = Math.min(RANK[assertion], RANK[sourceGrade]);
  return {
    grade: BY_RANK[weakest],
    assertion,
    source: sourceGrade,
    binding:
      RANK[assertion] === RANK[sourceGrade]
        ? "BOTH"
        : RANK[sourceGrade] < RANK[assertion]
          ? "SOURCE"
          : "ASSERTION",
  };
}

/** The state of a field the graph holds nothing for: no value, no provenance.
 *  Not produced by `displayedConfidence`, which grades an actual assertion. */
export const NO_CLAIM: DisplayedConfidence = {
  grade: "NO_CLAIM",
  assertion: "NO_CLAIM",
  source: null,
  binding: "ASSERTION",
};

/** Short grade word, for inline composition ("moderate reading"). */
export const GRADE_LABEL: Record<ConfidenceGrade, string> = {
  HIGH: "High",
  MEDIUM: "Moderate",
  LOW: "Low",
  UNRATED: "Unrated",
  NO_CLAIM: "No claim",
};

/** Full ICD-203 term, for headings. */
export const GRADE_TERM: Record<ConfidenceGrade, string> = {
  HIGH: "High confidence",
  MEDIUM: "Moderate confidence",
  LOW: "Low confidence",
  UNRATED: "Unrated",
  NO_CLAIM: "No claim",
};

/** Fraction of the circle the dot fills. The grade is carried twice — hue and
 *  area — because green/amber/red at 10px is the textbook deuteranopia failure
 *  and colour alone cannot be the only carrier of meaning. */
export const GRADE_FILL: Record<ConfidenceGrade, number> = {
  HIGH: 1,
  MEDIUM: 0.5,
  LOW: 0.25,
  UNRATED: 0,
  NO_CLAIM: 0,
};

export const GRADE_VAR: Record<ConfidenceGrade, string> = {
  HIGH: "--color-confidence-high",
  MEDIUM: "--color-confidence-med",
  LOW: "--color-confidence-low",
  UNRATED: "--color-confidence-none",
  NO_CLAIM: "--color-confidence-none",
};

/**
 * Which input set the grade, in a sentence. The templates are deliberate about
 * agency: a document can hold a claim down, a claim can only speak for itself.
 */
export function whyLine(conf: DisplayedConfidence): string {
  if (conf.grade === "NO_CLAIM") {
    return "The document gives no figure, so the field is left empty rather than guessed.";
  }
  const a = GRADE_LABEL[conf.assertion].toLowerCase();
  if (conf.source === null) {
    return `Set by the claim itself (${a}); there is no document to weigh it against.`;
  }
  if (conf.source === "UNRATED") {
    return "The document has not been rated yet. Rate it to grade this claim.";
  }
  const s = GRADE_LABEL[conf.source].toLowerCase();
  switch (conf.binding) {
    case "BOTH":
      return `Claim and document are both rated ${a}.`;
    case "ASSERTION":
      return `Set by the claim (${a}); the document is rated ${s}.`;
    case "SOURCE":
      return `Held down by the document (${s}); the claim itself is rated ${a}.`;
  }
}

export interface HowEntry {
  /** Bold lead word. */
  readonly word: string;
  /** Plain-language gloss after it. */
  readonly gloss: string;
}

/** How an assertion was produced, as a bold word plus a plain gloss. Keyed by
 *  `ProvenanceType` in api/src/models/provenance.py; NO_CLAIM covers a field
 *  with no assertion at all. */
export const HOW_ENTRY: Record<string, HowEntry> = {
  MEASURED: { word: "Measured", gloss: "A direct reading taken from the document." },
  REPORTED: { word: "Reported", gloss: "Stated in the document as written." },
  INFERRED: { word: "Inferred", gloss: "A person derived it from the document." },
  JUDGMENT: { word: "Analyst judgment", gloss: "A call made by a person." },
  MODEL_ESTIMATE: { word: "Model estimate", gloss: "A fitted or judged quantity." },
  AUTOMATED: {
    word: "Automated",
    gloss: "Written by a rule; re-running it gives the same result.",
  },
  UNKNOWN: { word: "Unknown", gloss: "No record of how this was produced." },
  NO_CLAIM: { word: "Not disclosed", gloss: "Nothing has been asserted." },
};

/** The Source row for a claim citing no document, in words that say why not.
 *  Keyed as `HOW_ENTRY`. */
export const UNSOURCED_SOURCE_NOTE: Record<string, string> = {
  JUDGMENT: "None. An analyst judgment; it rests on no document.",
  INFERRED: "None. A person derived it from other data, not read from a document.",
  MODEL_ESTIMATE: "None. A model estimate; it rests on no document.",
  AUTOMATED: "None. Produced by a matching rule, not read from a document.",
  UNKNOWN: "None. The graph does not record a document.",
  NO_CLAIM: "No source; there is no claim to cite one.",
};

/** Whether a human has stood behind the claim, in a sentence. */
export function checkedLine(provenance: ApiProvenance | null): string {
  if (!provenance) return "Nothing to check; no claim has been made.";
  if (provenance.type === "AUTOMATED") {
    return "Machine-written. Regenerated on every run, never hand-checked.";
  }
  if (provenance.unverified_model_extraction) {
    return "Written by a model reading the document. Not yet checked by a person.";
  }
  return "Checked by a person against the source.";
}

/** Renders the API's SCREAMING_SNAKE enums as prose. */
export function humanise(value: string): string {
  const s = value.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
