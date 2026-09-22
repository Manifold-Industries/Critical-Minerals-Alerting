// The asset overlay's section chrome, lifted out so more than one section can
// wear it. Nothing here changed on the way out — it is the same markup the
// overlay has always drawn, now shared rather than copied.

/**
 * A section that starts closed, so the header, the verification note and the
 * key facts keep the first screen. The heading carries a count so a closed
 * section still says whether there is anything inside; "none" is a statement,
 * not an absence, which is why an empty section is rendered rather than
 * dropped.
 */
export function CollapsibleSection({
  title,
  count,
  children,
}: {
  readonly title: string;
  /** Rows inside. Omit for prose sections, where a count means nothing, and
   *  while a section is still loading, where any number would be a guess. */
  readonly count?: number;
  readonly children: React.ReactNode;
}) {
  return (
    <details className="disclosure flex flex-col gap-1 border-t border-surface-2 pt-2">
      <summary className="flex cursor-pointer items-center gap-1.5 text-accent transition-colors hover:text-foreground">
        <span aria-hidden className="disclosure-caret text-[11px] leading-none">
          ▼
        </span>
        <h4 className="font-mono text-[9px] font-semibold tracking-[0.15em] uppercase">
          {title}
          {count !== undefined && (
            <span className="font-normal text-text-tertiary">
              {" "}
              ({count === 0 ? "none" : count})
            </span>
          )}
        </h4>
      </summary>
      {children}
    </details>
  );
}

/** What an open, empty section says. The graph is incomplete, not silent. */
export function Empty({ children }: { readonly children: string }) {
  return <p className="text-[9.5px] text-text-tertiary">{children}</p>;
}
