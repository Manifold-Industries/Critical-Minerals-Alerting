import type { MineExposure } from "@/lib/monitor/api";
import { capacityCaveat, pct } from "@/lib/monitor/format";
import type { AlertGraph } from "@/lib/monitor/graphs";
import { GRADE_LABEL, toGrade } from "@/lib/monitor/provenance";
import type { BriefLoadState } from "@/lib/monitor/useBriefData";
import { ConfidencePie } from "@/components/monitor/ProvenanceDot";
import {
  BRIEF_TABLE,
  BRIEF_TD,
  BRIEF_TD_NAME,
  BRIEF_TH,
  BriefNotice,
} from "./BriefSection";

interface BriefWhyItMattersProps {
  readonly graph?: AlertGraph;
  readonly exposure?: MineExposure;
  readonly exposureState: BriefLoadState;
  readonly hasMine: boolean;
}

// As on the panel: only the kinds a reader could over-read are labelled.
const KIND_LABEL: Record<string, string> = {
  PLATFORM: "Platform",
  SUBSYSTEM: "Subsystem",
  CATEGORY: "Class",
};

/** Systemic weight of the plants that lost feed, against disclosed capacity. */
function CapacityStatement({ graph }: { readonly graph: AlertGraph }) {
  const ctx = graph.capacity;
  if (!ctx) return null;
  const unknownAffected = ctx.undisclosed_facility_ids.length;
  if (ctx.affected_share == null || ctx.affected_tpa == null) {
    return (
      <p className="text-xs leading-relaxed text-foreground">
        Share of Dy/Tb separation capacity that lost feed:{" "}
        <span className="font-mono font-semibold text-accent">unknown</span>.{" "}
        <span className="text-text-secondary">
          {unknownAffected === 1
            ? "The plant that lost feed publishes"
            : `None of the ${unknownAffected} plants that lost feed publish`}{" "}
          a capacity figure, so this cannot be sized. It is not zero.
        </span>
      </p>
    );
  }
  const caveat = capacityCaveat(
    ctx.refiners_total - ctx.refiners_disclosing,
    unknownAffected,
  );
  return (
    <p className="text-xs leading-relaxed text-foreground">
      <span className="font-mono text-base font-semibold text-accent tabular-nums">
        {pct(ctx.affected_share)}
      </span>{" "}
      of known Dy/Tb separation capacity lost feed —{" "}
      {ctx.affected_tpa.toLocaleString("en-US")} of{" "}
      {ctx.total_tpa.toLocaleString("en-US")} tonnes a year, on{" "}
      {ctx.as_of_year} figures.
      {caveat && <span className="text-text-secondary"> {caveat}</span>}
    </p>
  );
}

/**
 * Section 3: how much of the system this touches, and what depends on it.
 *
 * Unlike the rail, every system is listed: the panel folds the less specific
 * ones away to keep the first screen short, and a document has no first screen.
 * The order is the server's - most specific and best evidenced first.
 */
export default function BriefWhyItMatters({
  graph,
  exposure,
  exposureState,
  hasMine,
}: BriefWhyItMattersProps) {
  return (
    <>
      {graph && <CapacityStatement graph={graph} />}

      {!exposure ? (
        <BriefNotice>
          {!hasMine
            ? "No mine is modelled behind this alert, so no end use can be derived."
            : exposureState === "loading"
              ? "Resolving end-use exposure…"
              : "The end-use layer could not be reached, so dependent systems are not listed. This is a gap in the brief, not a finding."}
        </BriefNotice>
      ) : exposure.platforms.length === 0 ? (
        <BriefNotice>
          No modelled component requires what this site carries. The end-use
          layer is incomplete, not empty.
        </BriefNotice>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-foreground">
            <span className="font-mono text-base font-semibold text-accent tabular-nums">
              {exposure.platforms.length}
            </span>{" "}
            weapons system{exposure.platforms.length === 1 ? "" : "s"} depend on{" "}
            {exposure.elements.join(" and ")}.
          </p>
          <table className={BRIEF_TABLE}>
            <thead>
              <tr>
                <th className={BRIEF_TH}>System</th>
                <th className={BRIEF_TH}>Kind</th>
                <th className={BRIEF_TH}>Through</th>
                <th className={BRIEF_TH}>Elements</th>
                <th className={BRIEF_TH}>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {exposure.platforms.map((platform) => {
                const grade = toGrade(platform.confidence);
                return (
                  <tr key={platform.platform_id}>
                    <td className={BRIEF_TD_NAME}>
                      {platform.name}
                      {platform.kind === "SUBSYSTEM" && platform.parent_name && (
                        <span className="block text-[10px] font-normal text-text-tertiary">
                          of {platform.parent_name}
                        </span>
                      )}
                    </td>
                    <td className={BRIEF_TD}>
                      {KIND_LABEL[platform.kind] ?? platform.kind}
                    </td>
                    <td className={BRIEF_TD}>
                      {platform.via_components.map((c) => c.name).join(", ")}
                    </td>
                    <td className={`${BRIEF_TD} font-mono`}>
                      {platform.elements.join("/")}
                    </td>
                    <td className={`${BRIEF_TD} whitespace-nowrap`}>
                      <span className="inline-flex items-center gap-1.5">
                        <ConfidencePie grade={grade} size={9} />
                        {GRADE_LABEL[grade]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-[10.5px] leading-relaxed text-text-tertiary">
            Evidence is the weakest claim on the best-supported chain from the
            element to the system, each claim graded no higher than the
            document under it.
          </p>
        </>
      )}
    </>
  );
}
