import type { ReactNode } from "react";

interface BriefSectionProps {
  /** Position in the document. Printed, so a reader can cite "section 4". */
  readonly number: number;
  readonly title: string;
  /** One line on what the section establishes, under the title. */
  readonly lede?: string;
  readonly children: ReactNode;
}

// One numbered section of the brief. The number and rule are the document's
// only structure, so every section goes through this rather than styling its
// own heading.
export default function BriefSection({
  number,
  title,
  lede,
  children,
}: BriefSectionProps) {
  return (
    <section className="brief-section flex flex-col gap-3">
      <header className="flex flex-col gap-1 border-b border-surface-2 pb-2">
        <h2 className="flex items-baseline gap-3">
          <span className="font-mono text-[11px] font-semibold text-accent tabular-nums">
            {String(number).padStart(2, "0")}
          </span>
          <span className="font-mono text-[11px] font-semibold tracking-[0.2em] text-foreground uppercase">
            {title}
          </span>
        </h2>
        {lede && (
          <p className="pl-[29px] text-[11px] leading-relaxed text-text-tertiary">
            {lede}
          </p>
        )}
      </header>
      <div className="flex flex-col gap-3 pl-[29px]">{children}</div>
    </section>
  );
}

/** Body text for a section that has nothing to show, and the reason. */
export function BriefNotice({ children }: { readonly children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-text-tertiary">{children}</p>;
}

// Table chrome shared by every section, so the document reads as one table
// style rather than four near-misses.
export const BRIEF_TABLE = "w-full border-collapse text-left";
export const BRIEF_TH =
  "border-b border-surface-2 py-1.5 pr-3 align-bottom font-mono text-[9px] font-medium tracking-[0.12em] text-text-tertiary uppercase";
export const BRIEF_TD =
  "border-b border-surface-2 py-2 pr-3 align-top text-[11px] leading-snug text-text-secondary";
export const BRIEF_TD_NAME = `${BRIEF_TD} font-semibold text-foreground`;
