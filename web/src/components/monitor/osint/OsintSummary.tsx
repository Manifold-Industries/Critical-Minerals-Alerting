import { summarySegments, type NodeOsint } from "@/lib/monitor/osint";

interface OsintSummaryProps {
  readonly data: NodeOsint;
}

/**
 * What the list is, above the list.
 *
 * Two lines and both are caveats as much as counts. The first says how much
 * came back and from how many publications, because three cards from one
 * outlet and three from three are different evidence and a reader cannot tell
 * from the headlines. The second is the producer's own statement of what the
 * ordering is worth — it is carried rather than written here, because the
 * console does not know how the ranking was made and anything it composed
 * would be describing a method it cannot see.
 */
export default function OsintSummary({ data }: OsintSummaryProps) {
  const segments = summarySegments(data);
  if (segments.length === 0 && !data.ranking_note) return null;
  return (
    <div className="flex flex-col gap-1">
      {segments.length > 0 && (
        <p className="font-mono text-[9px] tracking-[0.08em] text-text-tertiary">
          {segments.join(" · ")}
        </p>
      )}
      {data.ranking_note && (
        <p className="text-[9.5px] leading-relaxed text-text-tertiary">
          <span className="text-accent">Ranked, not scored.</span>{" "}
          {data.ranking_note}
        </p>
      )}
    </div>
  );
}
