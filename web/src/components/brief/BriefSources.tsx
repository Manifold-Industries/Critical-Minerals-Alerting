import type { Alert } from "@/lib/monitor/alerts";
import type { MineExposure } from "@/lib/monitor/api";
import { GRADE_LABEL, toGrade } from "@/lib/monitor/provenance";
import { ConfidencePie } from "@/components/monitor/ProvenanceDot";
import { BriefNotice } from "./BriefSection";

/**
 * Section 7: what the brief rests on.
 *
 * The report first, then the documents behind the end-use claims in the order
 * they were first cited. A source with no URL is printed as text, never as a
 * link, and each carries the reliability grade the graph gives the document -
 * which is a different thing from confidence in any one claim read out of it.
 */
export default function BriefSources({
  alert,
  exposure,
}: {
  readonly alert: Alert;
  readonly exposure?: MineExposure;
}) {
  const documents = exposure?.sources ?? [];
  return (
    <>
      <ol className="flex flex-col">
        <li className="grid grid-cols-[22px_1fr_auto] items-baseline gap-2 border-b border-surface-2 py-2">
          <span className="font-mono text-[10px] text-text-tertiary tabular-nums">R</span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold text-foreground">
              {alert.source.name}
            </span>
            <span className="text-[10px] text-text-tertiary">
              {alert.source.kind} · the report this alert was raised from
            </span>
          </span>
          <span className="text-[10px] text-text-secondary">
            Report confidence {alert.confidence.toLowerCase()}
          </span>
        </li>
        {documents.map((source, i) => {
          const grade = toGrade(source.source_confidence);
          const meta = [source.publisher, source.published_on, source.locator]
            .filter(Boolean)
            .join(" · ");
          return (
            <li
              key={source.id}
              className="grid grid-cols-[22px_1fr_auto] items-baseline gap-2 border-b border-surface-2 py-2"
            >
              <span className="font-mono text-[10px] text-text-tertiary tabular-nums">
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-semibold text-foreground underline decoration-surface-2 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
                  >
                    {source.name}
                  </a>
                ) : (
                  <span className="text-[11px] font-semibold text-foreground">
                    {source.name}
                  </span>
                )}
                {meta && <span className="text-[10px] text-text-tertiary">{meta}</span>}
                {source.url && (
                  <span className="print-only text-[9px] break-all text-text-tertiary">
                    {source.url}
                  </span>
                )}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] whitespace-nowrap text-text-secondary">
                <ConfidencePie grade={grade} size={9} />
                {GRADE_LABEL[grade]}
              </span>
            </li>
          );
        })}
      </ol>
      {documents.length === 0 && (
        <BriefNotice>
          No end-use documents are cited, because no end-use layer was loaded
          for this alert.
        </BriefNotice>
      )}
      <p className="text-[10.5px] leading-relaxed text-text-tertiary">
        Numbered documents stand behind the end-use claims in section 3, graded
        for the reliability of the document itself. Supply relationships and
        tonnages are cited per site in Monitor, under each asset&rsquo;s
        reference detail.
      </p>
    </>
  );
}
