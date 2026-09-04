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
    <div className="grid grid-cols-[90px_1fr] items-baseline gap-2">
      <dt className="font-mono text-[9px] font-semibold tracking-[0.2em] text-text-tertiary uppercase">
        {label}
      </dt>
      <dd className="text-xs leading-relaxed text-foreground">{children}</dd>
    </div>
  );
}

/**
 * Memo routing block, ruled off from the numbered sections below. The fields
 * are filled from the alert record: the subject is the alert's own title and
 * the reference its id and source, so the header can never drift from the
 * alert it routes.
 */
export default function MemoHeader({ alert, watchName }: MemoHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b-2 border-surface-2 pb-4">
      <p className="font-mono text-[10px] font-semibold tracking-[0.25em] text-text-secondary uppercase">
        Decision brief
      </p>
      <dl className="flex flex-col gap-1.5">
        <MemoRow label="For">{`Decision authority · ${watchName}`}</MemoRow>
        <MemoRow label="From">Strategic Alerts console — automated synthesis</MemoRow>
        <MemoRow label="Subject">{alert.title}</MemoRow>
        <MemoRow label="Reference">
          {`${alert.id} · ${alert.source.kind} — ${alert.source.name}`}
        </MemoRow>
      </dl>
    </header>
  );
}
