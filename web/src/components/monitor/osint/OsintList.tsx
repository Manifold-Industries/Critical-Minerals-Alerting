"use client";

import { useState } from "react";
import { OSINT_SHOWN, type OsintDevelopment } from "@/lib/monitor/osint";
import OsintCard from "./OsintCard";

interface OsintListProps {
  /** Best first, as the server ranked them. Never re-sorted here. */
  readonly developments: readonly OsintDevelopment[];
}

/**
 * The ranked developments, capped until the reader asks for the rest.
 *
 * The cap is on display only — the whole ranked list is already in hand, and
 * "show all" reveals it rather than fetching more. The order is the server's
 * and is passed through untouched: how it was arrived at is precisely what
 * this component is not supposed to know, so re-sorting would be substituting
 * our guess about relevance for the producer's.
 */
export default function OsintList({ developments }: OsintListProps) {
  const [expanded, setExpanded] = useState(false);
  const overflow = developments.length - OSINT_SHOWN;
  const shown = expanded ? developments : developments.slice(0, OSINT_SHOWN);

  return (
    <div className="flex flex-col gap-1.5">
      <ol className="flex flex-col gap-1.5">
        {shown.map((development) => (
          <li key={development.id}>
            <OsintCard development={development} />
          </li>
        ))}
      </ol>

      {overflow > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="cursor-pointer self-start font-mono text-[9px] tracking-[0.12em] text-accent uppercase transition-colors hover:text-foreground"
        >
          {/* "Developments", not "sources": the overlay's Sources section
              already means documents, and one word for two things would make
              the bibliography look like a subset of this list. */}
          {expanded
            ? `Show top ${OSINT_SHOWN}`
            : `Show all ${developments.length} developments`}
        </button>
      )}
    </div>
  );
}
