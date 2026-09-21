"use client";

import Link from "next/link";

import type { Alert } from "@/lib/monitor/alerts";
import { bottomLine, briefLimits } from "@/lib/monitor/brief";
import { DEFAULT_MODULE_HREF } from "@/lib/modules";
import type { FactorWeights } from "@/lib/monitor/ranking";
import { useBriefData } from "@/lib/monitor/useBriefData";
import BriefAlternatives from "./BriefAlternatives";
import BriefAtRisk from "./BriefAtRisk";
import BriefMasthead from "./BriefMasthead";
import BriefSection, { BriefNotice } from "./BriefSection";
import BriefSources from "./BriefSources";
import BriefWhyItMatters from "./BriefWhyItMatters";

interface BriefDocumentProps {
  readonly alert: Alert;
  readonly year?: number;
  readonly weights: FactorWeights | null;
  /** Something the link asked for that could not be honoured. */
  readonly problem?: string;
  /** Zulu date-time group, stamped by the server. */
  readonly generatedAt: string;
}

const TOOL_BUTTON =
  "blueprint cursor-pointer px-3 py-1.5 font-mono text-[10px] font-medium tracking-[0.15em] text-accent uppercase transition-colors hover:bg-accent-tint";

/**
 * The decision brief: one alert, assembled into a document that can be read
 * top to bottom, printed, or sent as a link.
 *
 * Assembled, not written. Every sentence is a fixed template filled from the
 * supply graph, so the brief can state nothing the graph does not hold - and
 * where the graph holds nothing, the section says so instead of going quiet.
 */
export default function BriefDocument({
  alert,
  year,
  weights,
  problem,
  generatedAt,
}: BriefDocumentProps) {
  const { graph, graphState, exposure, exposureState } = useBriefData(
    alert,
    year,
    weights,
  );
  // Same rule as the panel: a mine-backed alert reports the elements the mine
  // actually carries, and shows none while that is not yet known.
  const minerals = alert.mineId
    ? (exposure?.elements ?? null)
    : (alert.minerals ?? null);
  // An empty section means three different things; each says which.
  const emptyReason =
    graphState === "loading"
      ? "Simulating the disruption…"
      : graphState === "error"
        ? "The disruption engine could not be reached, so this section is empty. This is a gap in the brief, not a finding."
        : "No dependency graph exists for this alert.";
  const limits = briefLimits({ graph, exposure, weights });

  return (
    <div className="brief-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-surface-2 bg-background px-5 py-2.5">
        <Link href={DEFAULT_MODULE_HREF} className={TOOL_BUTTON}>
          ← Monitor
        </Link>
        <button type="button" onClick={() => window.print()} className={TOOL_BUTTON}>
          Print / save as PDF
        </button>
      </div>

      <article className="brief mx-auto flex w-full max-w-[860px] flex-col gap-9 px-8 py-8">
        {problem && (
          <p className="border border-caution px-3 py-2 text-xs leading-relaxed text-caution">
            {problem}
          </p>
        )}

        <BriefMasthead
          alert={alert}
          graph={graph}
          minerals={minerals}
          generatedAt={generatedAt}
        />

        <BriefSection number={1} title="Bottom line">
          {graphState === "loading" ? (
            <BriefNotice>{emptyReason}</BriefNotice>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {bottomLine({ alert, graph, exposure, weights }).map((line) => (
                <li
                  key={line}
                  className="border-l-2 border-accent pl-3 text-[13px] leading-relaxed text-foreground"
                >
                  {line}
                </li>
              ))}
            </ul>
          )}
        </BriefSection>

        <BriefSection number={2} title="What happened">
          <p className="text-xs leading-relaxed text-foreground">{alert.summary}</p>
          <p className="text-[10.5px] leading-relaxed text-text-tertiary">
            Reported via {alert.source.name} ({alert.source.kind.toLowerCase()}
            ), report confidence {alert.confidence.toLowerCase()}. This is the
            report as received; nothing below it verifies the event itself.
          </p>
        </BriefSection>

        <BriefSection
          number={3}
          title="Why it matters"
          lede="How much of the system this touches, and what depends on the element."
        >
          <BriefWhyItMatters
            graph={graph}
            exposure={exposure}
            exposureState={exposureState}
            hasMine={alert.mineId !== undefined}
          />
        </BriefSection>

        <BriefSection
          number={4}
          title="What is at risk"
          lede="The plants that lose feed if the site stays down."
        >
          <BriefAtRisk graph={graph} emptyReason={emptyReason} />
        </BriefSection>

        <BriefSection
          number={5}
          title="Recommended alternatives"
          lede="Sources that could be rerouted to the affected plants."
        >
          <BriefAlternatives
            graph={graph}
            weights={weights}
            emptyReason={emptyReason}
          />
        </BriefSection>

        <BriefSection
          number={6}
          title="Limits of this assessment"
          lede="What the figures above cannot support. Read before acting on them."
        >
          {limits.length === 0 ? (
            <BriefNotice>{emptyReason}</BriefNotice>
          ) : (
            <ul className="flex flex-col gap-2">
              {limits.map((limit) => (
                <li
                  key={limit}
                  className="grid grid-cols-[10px_1fr] gap-2 text-[11px] leading-relaxed text-text-secondary"
                >
                  <span aria-hidden className="text-accent">
                    ·
                  </span>
                  {limit}
                </li>
              ))}
            </ul>
          )}
        </BriefSection>

        <BriefSection number={7} title="Sources">
          <BriefSources alert={alert} exposure={exposure} />
        </BriefSection>

        <footer className="border-t border-surface-2 pt-3 font-mono text-[9px] leading-relaxed tracking-[0.05em] text-text-tertiary">
          DB-{alert.id} · Generated {generatedAt}
          {graph?.asOfYear ? ` · Simulated at ${graph.asOfYear}` : ""} · Assembled from the supply
          graph; no figure in this document is estimated or written by a model.
        </footer>
      </article>
    </div>
  );
}
