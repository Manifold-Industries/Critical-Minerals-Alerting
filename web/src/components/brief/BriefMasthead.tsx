import type { Alert, Confidence } from "@/lib/monitor/alerts";
import { SEVERITY_COLOR } from "@/lib/monitor/colors";
import type { AlertGraph } from "@/lib/monitor/graphs";
import ElementBadges from "@/components/monitor/ElementBadges";

interface BriefMastheadProps {
  readonly alert: Alert;
  readonly graph?: AlertGraph;
  /** Null while the elements are not yet known, as on the panel. */
  readonly minerals: readonly string[] | null;
  readonly generatedAt: string;
}

const CONFIDENCE_WORD: Record<Confidence, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[9px] tracking-[0.15em] text-text-tertiary uppercase">
        {label}
      </dt>
      <dd className="text-xs text-foreground">{children}</dd>
    </div>
  );
}

// The brief's title block: what document this is, what it is about, and the
// handful of facts a reader needs before deciding whether to read on.
export default function BriefMasthead({
  alert,
  graph,
  minerals,
  generatedAt,
}: BriefMastheadProps) {
  const asset = graph?.asset;
  return (
    <header className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-4 border-b border-accent pb-2">
        <p className="font-mono text-[11px] font-semibold tracking-[0.25em] text-accent uppercase">
          Decision brief
        </p>
        <p className="font-mono text-[10px] tracking-[0.15em] text-text-tertiary uppercase">
          DB-{alert.id} · {generatedAt}
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <p className="font-mono text-[10px] tracking-[0.15em] text-text-tertiary uppercase">
          {alert.domain} · {alert.subdomain}
        </p>
        <h1 className="text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {alert.title}
        </h1>
        {minerals && (
          <ElementBadges symbols={minerals} severity={alert.severity} size="lg" />
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-y border-surface-2 py-3 sm:grid-cols-4">
        <Field label="Affected site">
          {asset ? asset.name : "—"}
          {asset?.place && (
            <span className="block text-[10.5px] text-text-secondary">
              {asset.place}
            </span>
          )}
        </Field>
        <Field label="Severity">
          <span className="flex items-center gap-1.5 capitalize">
            <span
              aria-hidden
              className="inline-block size-2"
              style={{ backgroundColor: SEVERITY_COLOR[alert.severity] }}
            />
            {alert.severity}
          </span>
        </Field>
        <Field label="Report confidence">
          {CONFIDENCE_WORD[alert.confidence]}
        </Field>
        <Field label="Reported via">
          {alert.source.name}
          <span className="block text-[10.5px] text-text-secondary">
            {alert.source.kind}
          </span>
        </Field>
      </dl>
    </header>
  );
}
