import Link from "next/link";

import { ALERTS, sortBySeverity } from "@/lib/monitor/alerts";
import { briefHref } from "@/lib/monitor/briefLink";
import { SEVERITY_COLOR } from "@/lib/monitor/colors";

// What /brief shows with no alert in the link: every alert a brief can be
// assembled for. Briefs opened from here carry no weights, so their
// alternatives keep the default order; the monitor is where a ranking is set.
export default function BriefIndex({ problem }: { readonly problem?: string }) {
  const alerts = sortBySeverity(ALERTS);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5 px-8 py-8">
        <header className="flex flex-col gap-1 border-b border-accent pb-2">
          <h1 className="font-mono text-[11px] font-semibold tracking-[0.25em] text-accent uppercase">
            Decision briefs
          </h1>
          <p className="text-xs leading-relaxed text-text-secondary">
            One per alert, assembled from the supply graph. To brief on a ranking
            of your own, set the weights in Monitor and generate it from there.
          </p>
        </header>
        {problem && (
          <p className="border border-caution px-3 py-2 text-xs text-caution">
            {problem}
          </p>
        )}
        <ul className="flex flex-col">
          {alerts.map((alert) => (
            <li key={alert.id} className="border-t border-surface-2">
              <Link
                href={briefHref(alert.id)}
                className="grid grid-cols-[10px_64px_1fr] items-baseline gap-3 px-1 py-3 transition-colors hover:bg-ghost-hover"
              >
                <span
                  aria-hidden
                  className="inline-block size-2 translate-y-px"
                  style={{ backgroundColor: SEVERITY_COLOR[alert.severity] }}
                />
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-tertiary">
                  {alert.id}
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {alert.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
