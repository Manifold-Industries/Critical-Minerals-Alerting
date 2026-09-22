import type { CSSProperties } from "react";
import {
  PRIORITY_TONE_VAR,
  priorityTone,
  publishedLabel,
  screamingLabel,
  type OsintDevelopment,
} from "@/lib/monitor/osint";

interface OsintCardProps {
  readonly development: OsintDevelopment;
}

/** One labelled prose block inside an opened card. Rendered only where the
 *  producer extracted it: an empty heading claims a field it does not have. */
function Block({
  label,
  children,
}: {
  readonly label: string;
  readonly children: string | null;
}) {
  if (!children) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[9px] font-semibold tracking-[0.15em] text-text-tertiary uppercase">
        {label}
      </span>
      <p className="text-[10px] leading-relaxed text-text-secondary">{children}</p>
    </div>
  );
}

/**
 * One development, headline first and the reasoning behind a disclosure.
 *
 * Expands in place rather than opening a drawer. The reader clicked a node on
 * the globe to get here, and the whole value of the section is that it sits
 * beside the world model — a second panel would push the map out of view to
 * show prose about the thing the map is displaying.
 *
 * What stays visible when closed is what ranks the card: the headline, the
 * priority label, the category and where it came from. `relevance_score` is
 * not among them and is not anywhere below either. The number ordered the
 * list; rendering it as a percentage would offer it as calibrated confidence,
 * which a ranking score is not.
 */
export default function OsintCard({ development }: OsintCardProps) {
  const tone = priorityTone(development.priority);
  const published = publishedLabel(development.published_at);
  const provenance = [development.source.name, published]
    .filter(Boolean)
    .join(" · ");

  return (
    <details className="disclosure flex flex-col gap-1.5 border border-surface-2 px-2 py-1.5 transition-colors hover:border-text-tertiary">
      <summary className="flex cursor-pointer flex-col gap-1">
        <span className="flex items-start gap-1.5">
          <span
            aria-hidden
            className="disclosure-caret mt-px text-[10px] leading-none text-accent"
          >
            ▼
          </span>
          <span className="text-[11px] leading-snug font-semibold text-foreground">
            {development.title}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-1 pl-[15px]">
          {development.priority && (
            <span
              className="tag"
              style={
                {
                  color: `var(${PRIORITY_TONE_VAR[tone]})`,
                  border: `1px solid color-mix(in srgb, var(${PRIORITY_TONE_VAR[tone]}) 45%, var(--surface-2))`,
                } as CSSProperties
              }
              title={
                tone === "unranked"
                  ? "Priority label this console does not recognise"
                  : "Priority assigned by the ranking, not a validated risk score"
              }
            >
              {screamingLabel(development.priority)}
            </span>
          )}
          {development.category && (
            <span className="tag tag-neutral">
              {screamingLabel(development.category)}
            </span>
          )}
        </span>

        {provenance && (
          <span className="pl-[15px] font-mono text-[9px] tracking-[0.05em] text-text-tertiary">
            {provenance}
          </span>
        )}
      </summary>

      <div className="flex flex-col gap-2 pl-[15px]">
        <Block label="What changed">{development.what_changed}</Block>
        <Block label="Why it matters">{development.why_it_matters}</Block>
        <Block label="Summary">{development.summary}</Block>

        {development.tags.length > 0 && (
          <p className="font-mono text-[9px] tracking-[0.05em] text-text-tertiary">
            {development.tags.join(" · ")}
          </p>
        )}

        {/* An unanchored item is text, never a dead link — the same rule the
            overlay's bibliography follows for a source with no url. */}
        {development.source.url ? (
          <a
            href={development.source.url}
            target="_blank"
            rel="noreferrer"
            className="self-start font-mono text-[9px] tracking-[0.12em] text-accent uppercase underline decoration-surface-2 underline-offset-2 transition-colors hover:decoration-accent"
          >
            View source ↗
          </a>
        ) : (
          <span className="font-mono text-[9px] tracking-[0.12em] text-text-tertiary uppercase">
            No retrievable location
          </span>
        )}
      </div>
    </details>
  );
}
