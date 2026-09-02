import type { Provenance, Source } from "@/lib/api/types";
import { pretty } from "@/lib/provenance/fields";
import { SourceLink } from "@/components/entity/SourceLink";

interface ProvenanceRowProps {
  provenance: Provenance;
  sources: ReadonlyMap<string, Source>;
}

/** How one assertion is supported: type · confidence · verified date · source. */
export function ProvenanceRow({ provenance, sources }: ProvenanceRowProps) {
  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
      <span className="rounded bg-zinc-100 px-1 font-medium uppercase tracking-wide dark:bg-zinc-800">
        {pretty(provenance.type)}
      </span>
      {provenance.assertion_confidence && <span>{provenance.assertion_confidence} confidence</span>}
      <span>{provenance.last_verified ? `verified ${provenance.last_verified}` : "unverified"}</span>
      {provenance.source_id && <SourceLink sourceId={provenance.source_id} sources={sources} />}
    </p>
  );
}
