import { IconUpload } from "@tabler/icons-react";

interface MonitorHeaderProps {
  readonly watchName: string;
  readonly alertCount: number;
}

// Page header for the Strategic Alerts screen: brand + watch meta on the
// left, live-feed indicator and the upload entry point on the right. The
// Zulu clock lives in CommandHeader directly above, so it is not repeated
// here.
export default function MonitorHeader({
  watchName,
  alertCount,
}: MonitorHeaderProps) {
  return (
    <header className="flex items-center gap-5 border-b border-surface-2 px-5 py-3">
      <h1 className="text-lg leading-none font-semibold tracking-tight text-foreground">
        Strategic Alerts
      </h1>
      <p className="font-mono text-[10px] tracking-[0.2em] text-text-tertiary uppercase">
        {watchName}
      </p>
      <div className="ml-auto flex items-center gap-4">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.15em] uppercase">
          <span className="live-square" aria-hidden />
          <span className="text-positive">Feeds live</span>
          <span className="text-text-tertiary">
            · {alertCount} alert{alertCount === 1 ? "" : "s"}
          </span>
        </p>
        <button
          type="button"
          title="Upload a document to ingest it into a new strategic alert"
          className="blueprint flex cursor-pointer items-center gap-2 px-3 py-1.5 font-mono text-[11px] font-medium tracking-[0.15em] text-accent uppercase transition-colors hover:bg-accent-tint"
        >
          <IconUpload size={14} stroke={1.5} aria-hidden />
          New alert from document
        </button>
      </div>
    </header>
  );
}
