import type { Country, Source } from "@/lib/api/types";
import { NOT_ATTESTED } from "@/lib/provenance/fields";
import { ProvenanceRow } from "@/components/entity/ProvenanceRow";

interface CountryListProps {
  countries: Country[];
  sources: ReadonlyMap<string, Source>;
}

/** Jurisdictions with their attested alignment and risk score, or "not attested". */
export function CountryList({ countries, sources }: CountryListProps) {
  return (
    <aside className="w-64 shrink-0 overflow-y-auto border-l border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Jurisdictions</h2>
      <ul className="space-y-4">
        {countries.map((country) => (
          <li key={country.id} className="text-xs">
            <p className="font-medium text-zinc-800 dark:text-zinc-200">
              {country.name} <span className="text-zinc-400 dark:text-zinc-500">{country.iso_alpha2}</span>
            </p>
            <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">
              Alignment: {country.alignment ? country.alignment.value : NOT_ATTESTED}
            </p>
            {country.alignment && (
              <ProvenanceRow provenance={country.alignment.provenance} sources={sources} />
            )}
            <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">
              Risk score: {country.risk_score ? country.risk_score.value : NOT_ATTESTED}
            </p>
            {country.risk_score && (
              <ProvenanceRow provenance={country.risk_score.provenance} sources={sources} />
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
