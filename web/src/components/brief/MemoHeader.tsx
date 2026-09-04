import type { Alert } from "@/lib/monitor/alerts";

interface MemoHeaderProps {
  readonly alert: Alert;
  readonly watchName: string;
}

/** One For/From/Subject/Reference row. */
function MemoRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: string;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-baseline gap-2">
      <dt className="font-mono text-[11px] font-semibold tracking-[0.2em] text-text-tertiary uppercase">
        {label}
      </dt>
      <dd className="text-sm leading-relaxed text-foreground">{children}</dd>
    </div>
  );
}

/**
 * Memo routing block, ruled off from the numbered sections below. Every field
 * restates something the Decision Panel shows for this alert — the watch, the
 * source line ("via …"), the title, the id and DIMEFIL classification — so
 * the header can never drift from the alert it routes.
 */
export default function MemoHeader({ alert, watchName }: MemoHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b-2 border-surface-2 pb-4">
      <p className="font-mono text-sm font-semibold tracking-[0.25em] text-text-secondary uppercase">
        Decision brief
      </p>
      <dl className="flex flex-col gap-2">
        <MemoRow label="For">{watchName}</MemoRow>
        <MemoRow label="From">
          {`${alert.source.kind} — ${alert.source.name}`}
        </MemoRow>
        <MemoRow label="Subject">{alert.title}</MemoRow>
        <MemoRow label="Reference">
          {`${alert.id} · ${alert.domain} · ${alert.subdomain}`}
        </MemoRow>
      </dl>
    </header>
  );
}
