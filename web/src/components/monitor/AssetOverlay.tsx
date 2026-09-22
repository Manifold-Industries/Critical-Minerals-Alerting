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
import { humanise } from "@/lib/monitor/provenance";
import { CollapsibleSection, Empty } from "./Disclosure";
import OperatingStatusBadge from "./OperatingStatusBadge";
import OsintSection from "./osint/OsintSection";
import ProvenanceDot from "./ProvenanceDot";

interface AssetOverlayProps {
  /** Asset to describe. Null closes the overlay. */
  readonly assetId: string | null;
  readonly onClose: () => void;
}

/** source_id -> the document and its position in `sources`, which is the
 *  citation number. */
type SourceIndex = ReadonlyMap<
  string,
  { readonly n: number; readonly source: ApiSourceRef }
>;

function sourceIndex(sources: readonly ApiSourceRef[]): SourceIndex {
  return new Map(sources.map((source, i) => [source.id, { n: i + 1, source }]));
}

/**
 * How far to trust a claim, and where to go and check it.
 *
 * Two marks, because they answer two questions and often have different
 * answers. The dot grades the assertion and always appears. The footnote points
 * at a document and appears only where there is one: a judgment, an inference
 * and a model estimate rest on no document, and giving them a number would
 * invent one. The dot's popover says which of those a bare dot is.
 */
function Attribution({
  provenance,
  index,
  subject,
}: {
  readonly provenance: ApiProvenance | null;
  readonly index: SourceIndex;
  readonly subject: string;
}) {
  const entry = provenance?.source_id ? index.get(provenance.source_id) : undefined;
  return (
    <span className="ml-1 inline-flex items-center gap-1 align-middle">
      <ProvenanceDot
        provenance={provenance}
        source={entry?.source}
        citation={entry?.n}
        subject={subject}
      />
      {entry && (
        <span className="font-mono text-[9px] text-accent">[{entry.n}]</span>
      )}
    </span>
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
  readonly index: SourceIndex;
}) {
  const replaced = figure.superseded_by != null;
  const amount = `${figure.tonnes.toLocaleString()} t${
    figure.period === "LIFE_OF_MINE" ? " over life of mine" : " a year"
  }`;
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
          {amount}
        </span>
      </span>
      <span className="font-mono text-[9px] tracking-[0.1em] text-text-tertiary uppercase">
        {figure.target_year ? `by ${figure.target_year}` : "no target year"}
        {replaced && ` · replaced by the ${figure.superseded_by} figure`}
        {` · ${humanise(figure.provenance.type)}`}
        <Attribution
          provenance={figure.provenance}
          index={index}
          subject={`${figure.material_name ?? figure.material_id} · ${amount}`}
        />
      </span>
    </li>
  );
}

/**
 * How much of the card has been checked against the documents it cites.
 *
 * Top of the panel rather than under the bibliography: nothing in this graph
 * has been verified against its source, and that is the one thing a reader
 * should know before trusting any row. Computed rather than asserted, so it
 * cannot drift from the markers it describes.
 */
function VerificationNote({
  unverified,
  cited,
}: {
  readonly unverified: number;
  readonly cited: number;
}) {
  if (cited === 0) return null;
  return (
    <p className="text-[9.5px] leading-relaxed text-text-tertiary">
      <span className="text-accent">Unverified.</span> {unverified} of {cited}{" "}
      cited claims were extracted by a model and not yet checked by a person.
      Each dot shows the lower of its support and its source quality.
    </p>
  );
}

/**
 * The documents everything above rests on, numbered to match the markers.
 *
 * Collapsed by default: every fact here is also in the popover of the dot
 * beside the claim, so for a sighted reader this is a repeat. It stays because
 * the popover is hidden from assistive tech and its link is out of the tab
 * order, which makes this list the only keyboard-reachable route to a source,
 * and because the footnote numbers on the rows point into it.
 */
function Sources({ sources }: { readonly sources: readonly ApiSourceRef[] }) {
  return (
    <CollapsibleSection title="Sources" count={sources.length}>
      {sources.length === 0 && <Empty>No document is cited for this site.</Empty>}
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
                    ? `Source quality ${source.source_confidence.toLowerCase()}`
                    : "Source quality unrated",
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
    </CollapsibleSection>
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

  const index = sourceIndex(asset?.sources ?? []);
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
              {asset.country_name ? ` · ${asset.country_name}` : ""}
            </p>
          )}
          {/* Whether the site is running is the first fact a reader needs,
              so it gets its own line rather than a slot in the subtitle. It
              is still an attested claim, so its provenance stays beside it. */}
          {asset && (
            <div className="mt-1 flex items-center gap-1">
              <OperatingStatusBadge status={asset.operating_status} size="lg" />
              <Attribution
                provenance={asset.operating_status_provenance}
                index={index}
                subject={`Operating status · ${humanise(asset.operating_status)}`}
              />
            </div>
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
          <VerificationNote
            cited={provenances.length}
            unverified={
              provenances.filter((p) => p?.unverified_model_extraction).length
            }
          />

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
                  <Attribution
                    provenance={asset.development_stage_provenance}
                    index={index}
                    subject={`Development stage · ${humanise(asset.development_stage)}`}
                  />
                </dd>
              </>
            )}
            {asset.expected_start != null && (
              <>
                <dt className="text-text-tertiary uppercase">Expected start</dt>
                <dd className="text-text-secondary">
                  {asset.expected_start}
                  <Attribution
                    provenance={asset.expected_start_provenance}
                    index={index}
                    subject={`Expected start · ${asset.expected_start}`}
                  />
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
                <dt className="text-text-tertiary uppercase">Dy/Tb</dt>
                <dd className="text-accent">Separates Dy and Tb as its own product</dd>
              </>
            )}
          </dl>

          {/* Recent developments, ranked by relevance to this node. Directly
              under the key facts because it answers the same question they do
              — what state is this site in — rather than what it holds. It owns
              its own request, so a failure here leaves everything below intact. */}
          <OsintSection nodeId={asset.id} />

          <CollapsibleSection
            title={asset.kind === "MINE" ? "How much it produces" : "How much it can process"}
            count={asset.figures.length}
          >
            {asset.figures.length === 0 && (
              <Empty>
                {asset.kind === "MINE"
                  ? "No production figure is recorded for this mine."
                  : "This plant publishes no capacity figure."}
              </Empty>
            )}
            <ul className="flex flex-col divide-y divide-surface-2">
              {asset.figures.map((figure, i) => (
                <FigureRow
                  key={`${figure.material_id}-${figure.target_year}-${i}`}
                  figure={figure}
                  index={index}
                />
              ))}
            </ul>
          </CollapsibleSection>

          {asset.kind === "FACILITY" && (
            <CollapsibleSection title="What it takes in" count={asset.accepted_feeds.length}>
              {asset.accepted_feeds.length === 0 && (
                <Empty>No input material is recorded for this plant.</Empty>
              )}
              <ul className="flex flex-col gap-1">
                {asset.accepted_feeds.map((feed) => (
                  <li key={feed.material_id} className="text-[10.5px] text-text-secondary">
                    {feed.material_name ?? feed.material_id}
                    <span className="font-mono text-[9px] text-text-tertiary">
                      {" · "}
                      {feed.accepted_hosts.length
                        ? `from ${feed.accepted_hosts.map(humanise).join(", ")}`
                        : "host mineral not stated"}
                    </span>
                    <Attribution
                      provenance={feed.provenance}
                      index={index}
                      subject={`Takes in ${feed.material_name ?? feed.material_id}`}
                    />
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          )}

          <CollapsibleSection title="What it sells" count={asset.products.length}>
            {asset.products.length === 0 && (
              <Empty>No product is recorded for this site.</Empty>
            )}
            <ul className="flex flex-col gap-1">
              {asset.products.map((product) => (
                <li key={product.material_id} className="text-[10.5px] text-text-secondary">
                  {product.material_name ?? product.material_id}
                  <span className="font-mono text-[9px] text-text-tertiary">
                    {" · "}
                    {`in ${humanise(product.host_mineral).toLowerCase()}`}
                    {product.grade_pct_treo != null &&
                      ` · ${product.grade_pct_treo}% rare earth oxides`}
                  </span>
                  <Attribution
                    provenance={product.provenance}
                    index={index}
                    subject={`Sells ${product.material_name ?? product.material_id}`}
                  />
                </li>
              ))}
            </ul>
          </CollapsibleSection>

          <CollapsibleSection
            title="Who it trades with"
            count={asset.supplied_by.length + asset.supplies_to.length}
          >
            {asset.supplied_by.length + asset.supplies_to.length === 0 && (
              <Empty>No supply relationship is recorded for this site.</Empty>
            )}
            <ul className="flex flex-col gap-0.5">
              {asset.supplied_by.map((link) => (
                <li key={link.relationship_id} className="text-[10px] text-text-secondary">
                  <span className="font-mono text-[9px] text-text-tertiary">Buys from </span>
                  {link.name ?? link.id}
                  <span className="font-mono text-[9px] text-text-tertiary">
                    {" · "}
                    {humanise(link.status)}
                  </span>
                  <Attribution
                    provenance={link.provenance}
                    index={index}
                    subject={`Buys from ${link.name ?? link.id} · ${humanise(link.status)}`}
                  />
                </li>
              ))}
              {asset.supplies_to.map((link) => (
                <li key={link.relationship_id} className="text-[10px] text-text-secondary">
                  <span className="font-mono text-[9px] text-text-tertiary">Sells to </span>
                  {link.name ?? link.id}
                  <span className="font-mono text-[9px] text-text-tertiary">
                    {" · "}
                    {humanise(link.status)}
                  </span>
                  <Attribution
                    provenance={link.provenance}
                    index={index}
                    subject={`Sells to ${link.name ?? link.id} · ${humanise(link.status)}`}
                  />
                </li>
              ))}
            </ul>
          </CollapsibleSection>

          <CollapsibleSection title="Notes">
            {asset.description ? (
              <p className="text-[9.5px] leading-relaxed text-text-tertiary">
                {asset.description}
              </p>
            ) : (
              <Empty>No notes for this site.</Empty>
            )}
          </CollapsibleSection>

          <Sources sources={asset.sources} />
        </div>
      )}
    </aside>
  );
}
