"use client";

import { useEffect, useState } from "react";
import { fetchNodeOsint, type NodeOsint } from "@/lib/monitor/osint";
import { CollapsibleSection, Empty } from "../Disclosure";
import OsintList from "./OsintList";
import OsintSummary from "./OsintSummary";

interface OsintSectionProps {
  /** The node to describe. The only thing this section knows about it. */
  readonly nodeId: string;
}

type LoadState = "loading" | "idle" | "error";

/**
 * Recent developments affecting the selected node, ranked by relevance to it.
 *
 * The section knows a node id and an endpoint, and deliberately nothing else.
 * Whether the list behind it came from a curated file or from collection ->
 * entity resolution -> extraction -> ranking is invisible here, which is what
 * lets the demo's file be swapped for a pipeline without touching this tree.
 *
 * Two states are load-bearing rather than incidental.
 *
 * A node with nothing found renders the section anyway. Hiding it would say
 * this node cannot be monitored, when what is true is that nothing has been
 * found for it — the difference between a capability and a hard-coded demo.
 *
 * A failed request is contained here. The overlay's own facts, its figures and
 * its bibliography are a separate request and must survive this one going
 * down, so the failure reads as one unavailable section with a retry rather
 * than as an empty panel.
 */
export default function OsintSection({ nodeId }: OsintSectionProps) {
  // Keyed by the node it describes, so a late response for a node the reader
  // has already moved off is ignored rather than shown against the wrong name.
  const [result, setResult] = useState<{
    readonly nodeId: string;
    readonly attempt: number;
    readonly state: LoadState;
    readonly data?: NodeOsint;
  }>();
  // Bumping this re-runs the effect, which is all Retry has to do. It is part
  // of the result's key too, so the failed attempt stops matching the moment
  // the reader retries — otherwise the error would sit there, apparently
  // ignoring the click, until the new request came back.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchNodeOsint(nodeId, { signal: controller.signal })
      .then((data) => setResult({ nodeId, attempt, state: "idle", data }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResult({ nodeId, attempt, state: "error" });
      });
    return () => controller.abort();
  }, [nodeId, attempt]);

  // Derived, not stored: anything keyed to another node or an earlier attempt
  // reads as still loading rather than as an answer about this one.
  const current =
    result?.nodeId === nodeId && result.attempt === attempt ? result : undefined;
  const data = current?.state === "idle" ? current.data : undefined;

  return (
    <CollapsibleSection
      title="Relevant OSINT"
      // No count while it is still loading: any number would be a guess, and
      // "(none)" on a pending request reads as an answer.
      count={data?.developments.length}
    >
      {!current && (
        // Not "Analyzing…": the ranking is precomputed, and saying otherwise
        // would claim live analysis that is not happening.
        <Empty>Loading relevant developments…</Empty>
      )}

      {current?.state === "error" && (
        <div className="flex flex-col items-start gap-1">
          <p className="text-[9.5px] text-text-tertiary">
            <span className="text-accent">OSINT unavailable.</span> Relevant
            developments could not be loaded.
          </p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="cursor-pointer font-mono text-[9px] tracking-[0.12em] text-accent uppercase transition-colors hover:text-foreground"
          >
            Retry
          </button>
        </div>
      )}

      {data && data.developments.length === 0 && (
        <Empty>No prioritized development is currently held for this node.</Empty>
      )}

      {data && data.developments.length > 0 && (
        <div className="flex flex-col gap-2">
          <OsintSummary data={data} />
          <OsintList developments={data.developments} />
        </div>
      )}
    </CollapsibleSection>
  );
}
