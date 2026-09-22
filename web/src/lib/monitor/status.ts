// Operating status, as the console reads it. Mirrors `OperatingStatus` in
// api/src/models/lifecycle.py; the wire type is a bare string, so an unlisted
// value is shown as-is rather than rejected.

export type OperatingStatus =
  | "PLANNED"
  | "UNDER_CONSTRUCTION"
  | "COMMISSIONING"
  | "OPERATING"
  | "SUSPENDED"
  | "CLOSED";

/**
 * What a status means for supply, which is the only reason a reader cares.
 * Six statuses collapse to three answers: the site is producing, it is not yet
 * producing, or it has stopped. "unknown" is a fourth answer, not a default:
 * fixture graphs and thin records carry no status, and the badge must say so
 * rather than guess.
 */
export type StatusTone = "producing" | "pending" | "offline" | "unknown";

const TONE_BY_STATUS: Readonly<Record<OperatingStatus, StatusTone>> = {
  OPERATING: "producing",
  COMMISSIONING: "pending",
  UNDER_CONSTRUCTION: "pending",
  PLANNED: "pending",
  SUSPENDED: "offline",
  CLOSED: "offline",
};

function isOperatingStatus(value: string): value is OperatingStatus {
  return Object.hasOwn(TONE_BY_STATUS, value);
}

export function statusTone(status: string | null | undefined): StatusTone {
  if (!status || !isOperatingStatus(status)) return "unknown";
  return TONE_BY_STATUS[status];
}

/**
 * The colour each tone borrows. Producing and offline take the positive and
 * negative tokens; pending is deliberately colourless so a plant that is only
 * being built never competes with a severity square or the accent, and unknown
 * is the tertiary grey the rest of the console uses for "not stated".
 */
export const STATUS_TONE_VAR: Readonly<Record<StatusTone, string>> = {
  producing: "--color-positive",
  pending: "--color-text-secondary",
  offline: "--color-negative",
  unknown: "--color-text-tertiary",
};

/** What the badge says when the graph records no status. */
export const STATUS_UNKNOWN_LABEL = "Status not stated";
