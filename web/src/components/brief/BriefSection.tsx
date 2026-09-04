import type { ReactNode } from "react";

interface BriefSectionProps {
  readonly no: number;
  readonly title: string;
  /** Extra context stated in the header itself — §6 names the ranking
   *  criterion and its weight here, so the table below needs no legend. */
  readonly aside?: string;
  readonly children: ReactNode;
}

/** One numbered section of the memo, ruled off from the one above. */
export default function BriefSection({
  no,
  title,
  aside,
  children,
}: BriefSectionProps) {
  return (
    <section className="flex flex-col gap-3 border-t border-surface-2 pt-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-mono text-xs font-semibold tracking-[0.2em] text-accent uppercase">
          {no} · {title}
        </h3>
        {aside && (
          <p className="font-mono text-[11px] tracking-[0.12em] text-text-tertiary uppercase">
            {aside}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
