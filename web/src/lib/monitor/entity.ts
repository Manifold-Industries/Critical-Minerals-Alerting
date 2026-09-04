// Who and what an alert is about, shared by the decision panel's title block
// and the brief's subject strip so the two can never name different assets.

import type { Alert, Confidence } from "./alerts";
import type { MineExposure } from "./api";
import type { AlertGraph } from "./graphs";

/** What the alert hit: the kind of site, and which one. */
export interface Entity {
  readonly label: string;
  readonly name: string;
  readonly place: string;
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  HIGH: "Conf high",
  MEDIUM: "Conf med",
  LOW: "Conf low",
};

/**
 * Minerals this alert is about, or null while there is nothing honest to show.
 *
 * Same rule the queue row follows: a mine-backed alert reports the elements the
 * mine actually puts into the chain rather than a list of its own, and null
 * reads as "not yet known" rather than "none" while the fetch is out.
 */
export function mineralsFor(
  alert: Alert,
  exposure: MineExposure | undefined,
): readonly string[] | null {
  if (!alert.mineId) return alert.minerals ?? null;
  return exposure?.elements ?? null;
}

/** The asset the event hit — the subject of every section below the title. */
export function entityFor(
  alert: Alert,
  graph: AlertGraph | undefined,
): Entity | null {
  if (!graph) return null;
  return {
    // A mine-backed alert names a project by construction; a placeholder
    // fixture carries prose, whose last word is the nearest thing to a kind.
    label: alert.mineId
      ? "Mine"
      : (graph.asset.role.split(" ").at(-1) ?? graph.asset.role),
    name: graph.asset.name,
    place: graph.asset.place,
  };
}

/** Why the panel names no asset: a pending fetch, a failed one, or no graph. */
export function entityNotice(
  alert: Alert,
  state: "idle" | "loading" | "error",
): string {
  if (!alert.mineId) return "No modelled site";
  return state === "loading"
    ? "Resolving affected site…"
    : "Affected site unavailable";
}
