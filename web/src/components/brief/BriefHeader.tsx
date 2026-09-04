import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";

import type { Alert } from "@/lib/monitor/alerts";

interface BriefHeaderProps {
  readonly alert?: Alert;
  readonly watchName: string;
}

// Page header for the Brief screen: title and watch meta on the left, the way
// back to the console on the right. The Zulu clock lives in CommandHeader
// directly above, so it is not repeated here.
export default function BriefHeader({ alert, watchName }: BriefHeaderProps) {
  return (
    <header className="flex items-center gap-5 border-b border-surface-2 px-5 py-3">
      <h1 className="text-lg leading-none font-semibold tracking-tight text-foreground">
        Decision Brief
      </h1>
      <p className="font-mono text-[10px] tracking-[0.2em] text-text-tertiary uppercase">
        {watchName}
        {alert ? ` · ${alert.id}` : ""}
      </p>
      <Link
        href="/monitor"
        className="blueprint ml-auto flex items-center gap-2 px-3 py-1.5 font-mono text-[11px] font-medium tracking-[0.15em] text-accent uppercase transition-colors hover:bg-accent-tint"
      >
        <IconArrowLeft size={14} stroke={1.5} aria-hidden />
        Back to monitor
      </Link>
    </header>
  );
}
