// Derivations for the decision brief. Every sentence and figure here is
// composed from fields the console already holds — the alert record, the
// dependency graph, the end-use exposure — never invented. Where the graph
// holds no claim, the brief says "not modelled" rather than filling the gap.

import type { Alert, Confidence } from "@/lib/monitor/alerts";
import type { MineExposure } from "@/lib/monitor/api";
import type {
  AlertGraph,
  AlternativeSource,
  DownstreamNode,
  ScoringPolicy,
} from "@/lib/monitor/graphs";
import { nodesById } from "@/lib/monitor/graphs";
import { FACTOR_NAME, pct } from "@/lib/monitor/format";

/** One cell of the bottom-line stat row: a short value and the caveat under it. */
export interface BriefStat {
  readonly value: string;
  readonly detail: string;
}

/** Systemic weight of the event, sized only where a disclosure sizes it. */
export function consequenceStat(graph: AlertGraph | undefined): BriefStat {
  const cap = graph?.capacity;
  if (cap?.affected_share != null) {
    return {
      value: pct(cap.affected_share),
      detail: `of modelled Dy+Tb separation capacity lost feed, against nameplates disclosed at ${cap.as_of_year}`,
    };
  }
  if (cap) {
    return {
      value: "Unsized",
      detail:
        "the affected plants disclose no nameplate — the exposure is real but cannot be sized",
    };
  }
  if (graph) {
    const n = graph.downstream.length;
    return {
      value: `${n} node${n === 1 ? "" : "s"}`,
      detail: "downstream on the seeded dependency graph; no capacity model behind this alert",
    };
  }
  return { value: "—", detail: "no dependency graph behind this alert" };
}

/**
 * When the outage starts to bite, read off the supply structure alone: a plant
 * whose only feed is severed is degraded now, one that keeps a supplier has a
 * buffer of unknown depth. The graph holds no inventory or demand side, so
 * nothing finer than that is honest.
 */
export function timeToImpactStat(graph: AlertGraph | undefined): BriefStat {
  if (!graph) {
    return { value: "Not modelled", detail: "no dependency graph behind this alert" };
  }
  const known = graph.downstream.filter((n) => n.soleSource !== undefined);
  if (known.length === 0) {
    return {
      value: "Not modelled",
      detail: "the seeded graph carries no supply-count claims",
    };
  }
  const severed = known.filter((n) => n.soleSource).length;
  if (severed > 0) {
    return {
      value: "Immediate",
      detail: `${severed} node${severed === 1 ? " is" : "s are"} sole-sourced from the disrupted asset — no surviving supplier buffers ${severed === 1 ? "it" : "them"}`,
    };
  }
  return {
    value: "Buffered",
    detail:
      "every affected node keeps at least one other supplier; depth of the buffer is not modelled",
  };
}

/** The bottom line up front, assembled from the same facts the sections below
 *  lay out — a compression of the brief, not an extra claim. */
export function bluf(
  alert: Alert,
  graph: AlertGraph | undefined,
  exposure: MineExposure | undefined,
): string {
  const parts: string[] = [`${alert.title}.`];

  const cap = graph?.capacity;
  if (cap?.affected_share != null) {
    parts.push(
      `${pct(cap.affected_share)} of modelled Dy+Tb separation capacity has lost feed.`,
    );
  } else if (cap) {
    parts.push(
      "The affected plants disclose no nameplate, so the lost share is real but unsized.",
    );
  }

  if (exposure && exposure.platforms.length > 0) {
    parts.push(
      `${exposure.platforms.length} weapons systems depend on ${exposure.elements.join(" and ")} from this chain.`,
    );
  } else if (alert.affectedSystems?.length) {
    parts.push(`Downstream systems at risk: ${alert.affectedSystems.join(", ")}.`);
  }

  const top = graph?.alternatives[0];
  if (top) {
    parts.push(
      `The top-ranked alternative feed is ${top.name} (${top.country}); approval is requested to open qualification against it.`,
    );
  } else {
    parts.push(
      "No alternative feed is identified; the decision requested is to accept the exposure or direct collection.",
    );
  }
  return parts.join(" ");
}

/**
 * Confidence in one at-risk row, from what the row rests on: a disclosed
 * nameplate behind the loss share grades HIGH; a known supply structure with
 * no disclosed share grades MEDIUM; a seeded fixture node, which carries no
 * engine claims at all, grades LOW.
 */
export function nodeConfidence(node: DownstreamNode): Confidence {
  if (node.shareOfNameplate !== undefined) return "HIGH";
  if (node.soleSource !== undefined) return "MEDIUM";
  return "LOW";
}

/** What the node loses, stated only as firmly as the graph states it. */
export function nodeLoss(node: DownstreamNode): string {
  if (node.soleSource === undefined) return "Not modelled";
  if (node.soleSource) return "All feed";
  return "Partial feed";
}

/** What section 5 can honestly claim stays supplied. */
export interface SafeSummary {
  /** Affected nodes that keep at least one other supplier — degraded, not severed. */
  readonly buffered: readonly DownstreamNode[];
  /** Share of modelled capacity that did not lose feed, where disclosed. */
  readonly safeShare: number | null;
  readonly asOfYear: number | null;
  /** Affected plants missing from every share, so "safe" never overclaims. */
  readonly undisclosedCount: number;
}

export function safeSummary(graph: AlertGraph | undefined): SafeSummary {
  const cap = graph?.capacity;
  return {
    buffered: graph?.downstream.filter((n) => n.soleSource === false) ?? [],
    safeShare:
      cap?.affected_share != null ? Math.max(0, 1 - cap.affected_share) : null,
    asOfYear: cap?.as_of_year ?? null,
    undisclosedCount: cap?.undisclosed_facility_ids.length ?? 0,
  };
}

/** "Country alignment · weight 1.0" — the criterion the ranking was run under. */
export function rankingCriterion(scoring: ScoringPolicy | undefined): string | null {
  if (!scoring) return null;
  const active = Object.entries(scoring.weights).filter(([, w]) => w > 0);
  if (active.length === 0) return null;
  return active
    .map(([factor, w]) => `${FACTOR_NAME[factor] ?? factor} · weight ${w.toFixed(1)}`)
    .join(", ");
}

/**
 * The critical assumption under section 6: every row is an alternative *source
 * of feed*, and under a policy that gives capacity factors no weight, a top
 * rank asserts nothing about whether that feed exists at the needed scale.
 */
export function capacityAssumption(graph: AlertGraph | undefined): string {
  const scoring = graph?.scoring;
  if (!scoring) {
    return "Every row above is an alternative source of feed for the affected plants, not spare mining capacity in hand. The seeded graph carries no capacity claims for these sources, and their ordering is seeded rather than scored.";
  }
  const unweighted = ["coverage", "time_to_flow"].filter(
    (f) =>
      (scoring.weights[f] ?? 0) === 0 || scoring.excludedFactors.includes(f),
  );
  const base =
    "Every row above is an alternative source of feed for the affected plants, not spare mining capacity in hand.";
  if (unweighted.length === 0) {
    return `${base} Coverage and time-to-flow carry weight under ${scoring.version}, but both rest on disclosed figures only.`;
  }
  const names = unweighted.map((f) => FACTOR_NAME[f] ?? f).join(" and ");
  return `${base} Under ${scoring.version}, ${names.toLowerCase()} carry no weight, so a top rank does not assert that the source can cover the lost tonnage or how fast it could flow. Treat each row as a candidate to qualify, not a replacement in hand.`;
}

/** Section 7's content: the ask and what each disposition does. */
export interface DecisionRequest {
  readonly ask: string;
  readonly deadline: string;
  readonly approve: string;
  readonly defer: string;
  readonly noAction: string;
  readonly onApproval: readonly string[];
}

export function decisionRequest(
  alert: Alert,
  graph: AlertGraph | undefined,
  exposure: MineExposure | undefined,
): DecisionRequest {
  const top: AlternativeSource | undefined = graph?.alternatives[0];
  const feeds = top && graph ? nodesById(graph).get(top.feedsNodeId) : undefined;
  const severed =
    graph?.downstream.filter((n) => n.soleSource === true).length ?? 0;
  const systems =
    exposure?.platforms.length ?? alert.affectedSystems?.length ?? 0;
  const criterion = rankingCriterion(graph?.scoring);

  return {
    ask: top
      ? `Approve the opening of qualification against the ranked alternatives in §6, starting with ${top.name} (${top.country})${feeds ? ` as feed for ${feeds.name}` : ""}.`
      : "Acknowledge the exposure and direct collection against the gaps in §8 — no alternative feed is identified to qualify.",
    deadline:
      severed > 0
        ? `Before the next update of this watch (§9): ${severed} node${severed === 1 ? "" : "s"} in §4 ${severed === 1 ? "is" : "are"} severed now, and no qualification clock starts until a disposition is recorded.`
        : "Before the next update of this watch (§9), while the affected nodes are degraded rather than severed.",
    approve: top
      ? `Qualification of ${top.name} opens against the criterion stated in §6${criterion ? ` (${criterion.toLowerCase()})` : ""}; the mining-capacity assumption beneath it becomes the first thing that review must retire.`
      : "Collection is tasked against the gaps in §8 and this brief is reissued when they close.",
    defer: `The exposure stands as assessed until the next update${severed > 0 ? `; the ${severed} severed node${severed === 1 ? " stays" : "s stay"} without feed and no mitigation is on record` : ""}.`,
    noAction:
      systems > 0
        ? `The ${systems} system${systems === 1 ? "" : "s"} in §3 keep their dependency on the disrupted feed, with nothing on record that a mitigation was considered.`
        : "The dependency stands as assessed, with nothing on record that a mitigation was considered.",
    onApproval: [
      ...(top
        ? [
            `Open a qualification review of ${top.name}, testing the mining-capacity assumption in §6 first.`,
          ]
        : []),
      "Re-run the disruption simulation with any approved source included as feed, and reissue this brief.",
      `Record the disposition against alert ${alert.id}.`,
    ],
  };
}

/** Section 8: what the assessment leans on, and where the graph is silent. */
export function assumptions(
  alert: Alert,
  graph: AlertGraph | undefined,
  exposure: MineExposure | undefined,
): readonly string[] {
  const out: string[] = [];
  const cap = graph?.capacity;

  if (cap) {
    const undisclosed = cap.undisclosed_facility_ids.length;
    out.push(
      `Capacity shares are struck against disclosed nameplates only — ${cap.refiners_disclosing} of ${cap.refiners_total} Dy/Tb refiners disclose at ${cap.as_of_year}${undisclosed > 0 ? `, and ${undisclosed} affected plant${undisclosed === 1 ? "" : "s"} with no nameplate ${undisclosed === 1 ? "is" : "are"} absent from every share` : ""}.`,
    );
  }

  const fallbacks = new Set<string>();
  for (const alt of graph?.alternatives ?? []) {
    for (const f of alt.scoreFactors ?? []) {
      if (f.maxContribution > 0 && !f.known) fallbacks.add(f.factor);
    }
  }
  if (fallbacks.size > 0) {
    const names = [...fallbacks].map((f) => FACTOR_NAME[f] ?? f).join(", ");
    out.push(
      `Fallback values stood in for scoring inputs the graph does not hold (${names.toLowerCase()}); the ranks leaning on them rest on defaults, not disclosures.`,
    );
  }

  if (exposure) {
    out.push(
      "End-use claims are class-level, open-source assertions — bills of materials are classified, and nothing here says material from this site reached a particular airframe.",
    );
    out.push(...exposure.warnings);
  }

  out.push(
    "The graph carries no demand side, so no shortfall is sized: the brief states what depends on the lost feed, not how much production is lost.",
  );

  if (!alert.mineId) {
    out.push(
      "No engine behind this alert: the dependency graph and the alternatives are seeded placeholders pending a live feed.",
    );
  }
  return out;
}

/** The closing line: what the whole document rests on. */
export function basisLine(
  alert: Alert,
  graph: AlertGraph | undefined,
  exposure: MineExposure | undefined,
): string {
  const parts: string[] = [
    `source ${alert.source.kind.toLowerCase()} — ${alert.source.name}`,
  ];
  if (alert.mineId) {
    parts.push(
      graph?.capacity
        ? `disruption simulated on the live supply graph, struck at ${graph.capacity.as_of_year}`
        : "disruption simulated on the live supply graph",
    );
  } else {
    parts.push("dependency graph seeded pending a live feed");
  }
  if (exposure) {
    const n = exposure.sources.length;
    parts.push(`end-use exposure from ${n} cited open source${n === 1 ? "" : "s"}`);
  }
  return `Basis: ${parts.join("; ")}.`;
}
