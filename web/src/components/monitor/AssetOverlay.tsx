"use client";

import { useEffect, useState } from "react";
import { IconX } from "@tabler/icons-react";
import {
  fetchAsset,
  type AssetDetail,
  type ApiMaterialFigure,
  type ApiProvenance,
  type ApiSourceRef,
} from "@/lib/monitor/api";

interface AssetOverlayProps {
  /** Asset to describe. Null closes the overlay. */
  readonly assetId: string | null;
  readonly onClose: () => void;
}

function humanise(value: string): string {
  const s = value.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** source_id -> its position in `sources`, which is the citation number. */
type CitationIndex = ReadonlyMap<string, { readonly n: number; readonly name: string }>;

function citationIndex(sources: readonly ApiSourceRef[]): CitationIndex {
  return new Map(sources.map((s, i) => [s.id, { n: i + 1, name: s.name }]));
}

/**
 * Footnote marker pointing at the document a claim rests on.
 *
 * Renders nothing where the provenance names no source. That is not a gap to
 * paper over: a judgment, an inference and a model estimate rest on no
 * document, and giving them a marker would invent one. The row's own
 * provenance type already says which it is.
 */
function Cite({
  provenance,
  index,
}: {
  readonly provenance: ApiProvenance | null;
  readonly index: CitationIndex;
}) {
  const entry = provenance?.source_id ? index.get(provenance.source_id) : undefined;
  if (!entry) return null;
  return (
    <span
      title={entry.name}
      className="ml-0.5 cursor-help font-mono text-[9px] text-accent"
    >
      [{entry.n}]
    </span>
  );
}

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-t border-surface-2 pt-2">
      <h4 className="font-mono text-[9px] font-semibold tracking-[0.15em] text-accent uppercase">
        {title}
      </h4>
      {children}
    </div>
  );
}

/**
 * Staged figures supersede rather than accumulate, so a superseded row is shown
 * struck through with the year that replaced it. Summing this column would
 * overstate the asset, which is exactly the mistake the marker exists to stop.
 */
function FigureRow({
  figure,
  index,
}: {
  readonly figure: ApiMaterialFigure;
  readonly index: CitationIndex;
}) {
  const replaced = figure.superseded_by != null;
  return (
    <li className="flex flex-col gap-0.5 py-1">
      <span className="flex items-baseline justify-between gap-2">
        <span
          className={`text-[10.5px] ${replaced ? "text-text-tertiary line-through" : "text-foreground"}`}
        >
          {figure.material_name ?? figure.material_id}
        </span>
        <span
          className={`shrink-0 font-mono text-[10px] tabular-nums ${
            replaced ? "text-text-tertiary line-through" : "text-foreground"
          }`}
        >
          {figure.tonnes.toLocaleString()} t
          {figure.period === "LIFE_OF_MINE" ? " LOM" : "/yr"}
        </span>
      </span>
      <span className="font-mono text-[9px] tracking-[0.1em] text-text-tertiary uppercase">
        {figure.target_year ? `by ${figure.target_year}` : "no target year"}
        {replaced && ` · superseded by ${figure.superseded_by}`}
        {` · ${figure.provenance.type.toLowerCase()}`}
        {figure.provenance.assertion_confidence &&
          ` · conf ${figure.provenance.assertion_confidence.toLowerCase()}`}
        <Cite provenance={figure.provenance} index={index} />
      </span>
      {figure.note && (
        <span className="text-[9.5px] leading-relaxed text-text-tertiary">
          {figure.note}
        </span>
      )}
    </li>
  );
}

/**
 * The documents everything above rests on, numbered to match the markers.
 *
 * Bottom of the panel rather than inline: a citation is what a reader reaches
 * for after a figure has caught their eye, and the full name of an ASX
 * announcement beside every tonnage would bury the tonnages.
 *
 * Two things this has to keep saying. The confidence here rates the *document*,
 * while the confidence on a row rates the reading drawn from it — a careful
 * reading of a weak source is not a strong claim. And nothing in this graph has
 * been checked against the document it cites, so the count of unverified
 * extractions is computed and stated rather than left for a reader to assume
 * the friendlier answer.
 */
function Sources({
  sources,
  unverified,
  cited,
}: {
  readonly sources: readonly ApiSourceRef[];
  readonly unverified: number;
  readonly cited: number;
}) {
  return (
    <Section title={`Sources (${sources.length})`}>
      <ol className="flex flex-col gap-1.5">
        {sources.map((source, i) => (
          <li key={source.id} className="grid grid-cols-[14px_1fr] gap-1.5">
            <span className="font-mono text-[9px] text-accent tabular-nums">
              {i + 1}
            </span>
            <span className="flex flex-col gap-0.5">
              {/* An unanchored source is text, never a dead link. */}
              {source.url ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  title={source.name}
                  className="line-clamp-2 text-[10px] leading-snug text-text-secondary underline decoration-surface-2 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
                >
                  {source.name}
                </a>
              ) : (
                <span
                  title={source.name}
                  className="line-clamp-2 text-[10px] leading-snug text-text-secondary"
                >
                  {source.name}
                </span>
              )}
              <span className="font-mono text-[9px] tracking-[0.05em] text-text-tertiary">
                {[
                  source.publisher,
                  source.published_on,
                  humanise(source.source_type),
                  source.source_confidence
                    ? `Source conf ${source.source_confidence.toLowerCase()}`
                    : "Source unrated",
                  source.url ? null : "No retrievable location",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {source.locator && (
                <span
                  title={source.locator}
                  className="line-clamp-1 cursor-help font-mono text-[9px] text-text-tertiary/70"
                >
                  {source.locator}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-1 text-[9.5px] leading-relaxed text-text-tertiary">
        <span className="text-accent">Unverified.</span> {unverified} of {cited}{" "}
        cited claims were read out of these documents by a model and checked by
        nobody. Confidence above rates the reading; source confidence here rates
        the document.
      </p>
    </Section>
  );
}

// Reference detail for whichever node is selected, anchored bottom-right — the
// only corner the mode tabs, zoom controls and legend leave free.
export default function AssetOverlay({ assetId, onClose }: AssetOverlayProps) {
  // Keyed by the asset it describes, so a late response for a node the user has
  // already moved off is ignored rather than shown against the wrong name.
  const [result, setResult] = useState<{
    readonly id: string;
    readonly asset?: AssetDetail;
    readonly failed?: boolean;
  }>();

  useEffect(() => {
    if (!assetId) return;
    const controller = new AbortController();
    fetchAsset(assetId, { signal: controller.signal })
      .then((asset) => setResult({ id: assetId, asset }))
      // A 404 is expected: the placeholder alerts use fixture node ids that name
      // no asset in the graph. Nothing to show, and nothing worth reporting.
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResult({ id: assetId, failed: true });
      });
    return () => controller.abort();
  }, [assetId]);

  if (!assetId) return null;
  const current = result?.id === assetId ? result : undefined;
  if (current?.failed) return null;
  const asset = current?.asset;

  const index = citationIndex(asset?.sources ?? []);
  // Same walk the API uses to collect sources, so the counts describe exactly
  // the claims the markers point at.
  const provenances = asset
    ? [
        asset.operating_status_provenance,
        asset.development_stage_provenance,
        asset.expected_start_provenance,
        ...asset.figures.map((f) => f.provenance),
        ...asset.accepted_feeds.map((f) => f.provenance),
        ...asset.products.map((p) => p.provenance),
        ...asset.supplied_by.map((l) => l.provenance),
        ...asset.supplies_to.map((l) => l.provenance),
      ].filter((p) => p?.source_id != null)
    : [];

  return (
    <aside
      className="absolute right-3 bottom-3 z-20 flex max-h-[min(70%,34rem)] w-[22rem] flex-col border border-surface-2 bg-surface-1/95 backdrop-blur-sm"
      aria-label={asset ? `Detail for ${asset.name}` : "Asset detail"}
    >
      <div className="flex items-start justify-between gap-2 border-b border-surface-2 px-3 py-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="truncate text-xs font-semibold text-foreground">
            {asset ? asset.name : "Loading…"}
          </h3>
          {asset && (
            <p className="font-mono text-[9px] tracking-[0.1em] text-text-tertiary uppercase">
              {asset.kind === "MINE" ? "Mine" : humanise(asset.facility_type ?? "Facility")}
              {" · "}
              {humanise(asset.operating_status)}
              <Cite provenance={asset.operating_status_provenance} index={index} />
              {asset.country_name ? ` · ${asset.country_name}` : ""}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close asset detail"
          className="shrink-0 cursor-pointer p-0.5 text-text-tertiary transition-colors hover:text-accent"
        >
          <IconX size={14} />
        </button>
      </div>

      {asset && (
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto px-3 py-2.5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[9px] tracking-[0.05em]">
            {asset.operator_name && (
              <>
                <dt className="text-text-tertiary uppercase">Operator</dt>
                <dd className="text-text-secondary">{asset.operator_name}</dd>
              </>
            )}
            {asset.development_stage && (
              <>
                <dt className="text-text-tertiary uppercase">Stage</dt>
                <dd className="text-text-secondary">
                  {humanise(asset.development_stage)}
                  <Cite provenance={asset.development_stage_provenance} index={index} />
                </dd>
              </>
            )}
            {asset.expected_start != null && (
              <>
                <dt className="text-text-tertiary uppercase">Start</dt>
                <dd className="text-text-secondary">
                  {asset.expected_start}
                  <Cite provenance={asset.expected_start_provenance} index={index} />
                </dd>
              </>
            )}
            {asset.deposit && (
              <>
                <dt className="text-text-tertiary uppercase">Deposit</dt>
                <dd className="text-text-secondary">
                  {asset.deposit.name}
                  {asset.deposit.deposit_type ? ` · ${asset.deposit.deposit_type}` : ""}
                </dd>
              </>
            )}
            {asset.is_dytb_refiner && (
              <>
                <dt className="text-text-tertiary uppercase">Output</dt>
                <dd className="text-accent">Dedicated Dy/Tb stream</dd>
              </>
            )}
          </dl>

          {asset.figures.length > 0 && (
            <Section
              title={asset.kind === "MINE" ? "Production figures" : "Nameplate capacity"}
            >
              <p className="text-[9.5px] leading-relaxed text-text-tertiary">
                Staged and superseding: a later entry replaces the earlier one for the
                same material rather than adding to it.
              </p>
              <ul className="flex flex-col divide-y divide-surface-2">
                {asset.figures.map((figure, i) => (
                  <FigureRow
                    key={`${figure.material_id}-${figure.target_year}-${i}`}
                    figure={figure}
                    index={index}
                  />
                ))}
              </ul>
            </Section>
          )}

          {asset.accepted_feeds.length > 0 && (
            <Section title="Feed envelope">
              <ul className="flex flex-col gap-1">
                {asset.accepted_feeds.map((feed) => (
                  <li key={feed.material_id} className="text-[10.5px] text-text-secondary">
                    {feed.material_name ?? feed.material_id}
                    <span className="font-mono text-[9px] text-text-tertiary">
                      {" · "}
                      {feed.accepted_hosts.length
                        ? feed.accepted_hosts.map(humanise).join(", ")
                        : "any host / undisclosed"}
                    </span>
                    <Cite provenance={feed.provenance} index={index} />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {asset.products.length > 0 && (
            <Section title="Ships">
              <ul className="flex flex-col gap-1">
                {asset.products.map((product) => (
                  <li key={product.material_id} className="text-[10.5px] text-text-secondary">
                    {product.material_name ?? product.material_id}
                    <span className="font-mono text-[9px] text-text-tertiary">
                      {" · "}
                      {humanise(product.host_mineral)}
                      {product.grade_pct_treo != null && ` · ${product.grade_pct_treo}% TREO`}
                    </span>
                    <Cite provenance={product.provenance} index={index} />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {(asset.supplied_by.length > 0 || asset.supplies_to.length > 0) && (
            <Section title="Curated supply links">
              <ul className="flex flex-col gap-0.5">
                {asset.supplied_by.map((link) => (
                  <li key={link.relationship_id} className="text-[10px] text-text-secondary">
                    <span className="font-mono text-[9px] text-text-tertiary">← </span>
                    {link.name ?? link.id}
                    <span className="font-mono text-[9px] text-text-tertiary">
                      {" · "}
                      {humanise(link.status)}
                    </span>
                    <Cite provenance={link.provenance} index={index} />
                  </li>
                ))}
                {asset.supplies_to.map((link) => (
                  <li key={link.relationship_id} className="text-[10px] text-text-secondary">
                    <span className="font-mono text-[9px] text-text-tertiary">→ </span>
                    {link.name ?? link.id}
                    <span className="font-mono text-[9px] text-text-tertiary">
                      {" · "}
                      {humanise(link.status)}
                    </span>
                    <Cite provenance={link.provenance} index={index} />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {asset.description && (
            <Section title="Notes">
              <p className="text-[9.5px] leading-relaxed text-text-tertiary">
                {asset.description}
              </p>
            </Section>
          )}

          {asset.sources.length > 0 && (
            <Sources
              sources={asset.sources}
              cited={provenances.length}
              unverified={
                provenances.filter((p) => p?.unverified_model_extraction).length
              }
            />
          )}
        </div>
      )}
    </aside>
  );
}
