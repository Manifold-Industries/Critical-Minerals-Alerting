import type { Source } from "@/lib/api/types";

interface SourceLinkProps {
  sourceId: string;
  sources: ReadonlyMap<string, Source>;
}

/** Source name linked to its document, or an explicit unanchored marker. */
export function SourceLink({ sourceId, sources }: SourceLinkProps) {
  const source = sources.get(sourceId);
  if (!source) {
    return <span className="text-red-600 dark:text-red-400">unknown source {sourceId}</span>;
  }
  if (!source.url) {
    return (
      <span title={source.name} className="italic text-zinc-500 dark:text-zinc-400">
        {source.name} — document not yet identified
      </span>
    );
  }
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sky-700 underline decoration-dotted hover:decoration-solid dark:text-sky-400"
    >
      {source.name}
    </a>
  );
}
