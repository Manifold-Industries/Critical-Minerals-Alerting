"use client";

import Link from "next/link";

import type { Alert } from "@/lib/monitor/alerts";
import { DEFAULT_MODULE_HREF } from "@/lib/modules";
import type { FactorWeights } from "@/lib/monitor/ranking";
import { useBriefData } from "@/lib/monitor/useBriefData";
import BriefMasthead from "./BriefMasthead";
import BriefSection, { BriefNotice } from "./BriefSection";

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
  const { graph } = useBriefData(alert, year, weights);
  const minerals = alert.mineId ? null : (alert.minerals ?? null);

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
          <BriefNotice>The assessment in a few sentences.</BriefNotice>
        </BriefSection>
        <BriefSection number={2} title="What happened">
          <BriefNotice>The reported event and where the report came from.</BriefNotice>
        </BriefSection>
        <BriefSection number={3} title="Why it matters">
          <BriefNotice>Capacity that lost feed, and the systems that depend on the element.</BriefNotice>
        </BriefSection>
        <BriefSection number={4} title="What is at risk">
          <BriefNotice>The plants downstream of the site.</BriefNotice>
        </BriefSection>
        <BriefSection number={5} title="Recommended alternatives">
          <BriefNotice>Replacement sources, as ranked.</BriefNotice>
        </BriefSection>
        <BriefSection number={6} title="Limits of this assessment">
          <BriefNotice>What the figures above cannot support.</BriefNotice>
        </BriefSection>
        <BriefSection number={7} title="Sources">
          <BriefNotice>The documents the brief rests on.</BriefNotice>
        </BriefSection>

        <footer className="border-t border-surface-2 pt-3 font-mono text-[9px] leading-relaxed tracking-[0.05em] text-text-tertiary">
          DB-{alert.id} · Generated {generatedAt} · Assembled from the supply
          graph; no figure in this document is estimated or written by a model.
        </footer>
      </article>
    </div>
  );
}
