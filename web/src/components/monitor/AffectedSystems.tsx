import type {
  ApiPlatformExposure,
  ApiProvenance,
  ApiSourceRef,
  MineExposure,
} from "@/lib/monitor/api";
import {
  displayedConfidence,
  humanise,
  toGrade,
  GRADE_LABEL,
} from "@/lib/monitor/provenance";
import { ConfidenceDot, ConfidencePie } from "./ProvenanceDot";

/** source_id -> the document, so an edge can name what it rests on. */
type ExposureSources = ReadonlyMap<string, ApiSourceRef>;

/** One assertion on the route from this mine's elements to a platform. */
interface PathEdge {
  readonly key: string;
  readonly label: string;
  readonly provenance: ApiProvenance;
}

/**
 * The assertions a platform's grade is drawn from, outermost first.
 *
 * Two hops: the platform requires a component, and that component requires a
 * material carrying the element. Read off the response rather than recomputed -
 * the server already decided which route is best, and deriving a second answer
 * here is how the popover comes to disagree with the dot above it.
 */
function pathEdges(
  platform: ApiPlatformExposure,
  exposure: MineExposure,
): readonly PathEdge[] {
  const out: PathEdge[] = [];
  for (const link of platform.via_components) {
    out.push({
      key: `c-${link.component_id}`,
      label: `Requires ${link.name}`,
      provenance: link.provenance,
    });
    const component = exposure.components.find(
      (c) => c.component_id === link.component_id,
    );
    for (const material of component?.via_materials ?? []) {
      if (!material.provenance) continue;
      out.push({
        key: `m-${link.component_id}-${material.material_id}`,
        label: `${link.name} requires ${material.material_name ?? material.material_id}`,
        provenance: material.provenance,
      });
    }
  }
  return out;
}

/** One edge, graded the same way every other claim in the console is. */
function PathEdgeRow({
  edge,
  sources,
}: {
  readonly edge: PathEdge;
  readonly sources: ExposureSources;
}) {
  const source = edge.provenance.source_id
    ? sources.get(edge.provenance.source_id)
    : undefined;
  const conf = displayedConfidence(edge.provenance, source);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-start gap-1.5">
        <span className="mt-[3px]">
          <ConfidencePie grade={conf.grade} size={8} />
        </span>
        <span className="text-[9.5px] leading-snug text-text-secondary">
          {edge.label}
        </span>
      </span>
      <span className="ml-[14px] font-mono text-[9px] text-text-tertiary">
        {[
          `${GRADE_LABEL[conf.assertion].toLowerCase()} reading`,
          conf.source !== null
            ? `${GRADE_LABEL[conf.source].toLowerCase()} source`
            : "no document",
          humanise(edge.provenance.type).toLowerCase(),
        ].join(" · ")}
      </span>
      {source &&
        (source.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            // See SourceBlock: the popover is aria-hidden, so nothing inside it
            // may take focus.
            tabIndex={-1}
            className="ml-[14px] line-clamp-1 text-[9px] text-text-tertiary underline decoration-surface-2 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
          >
            {source.name}
          </a>
        ) : (
          <span className="ml-[14px] line-clamp-1 text-[9px] text-text-tertiary">
            {source.name}
          </span>
        ))}
    </div>
  );
}

/**
 * How well evidenced this mine's dependency on a weapons system is.
 *
 * The grade is a path minimum rather than one assertion's, but it is the same
 * rule: no link is stronger than the document under it, and the path is no
 * stronger than its weakest link. Grading on assertions alone painted almost
 * this entire list green - every component edge in the graph is asserted HIGH
 * while the documents behind them are not, and one of them is a Wikipedia
 * article. On a list of weapons systems that is the worst place to be generous.
 */
function PlatformConfidence({
  platform,
  exposure,
  sources,
}: {
  readonly platform: ApiPlatformExposure;
  readonly exposure: MineExposure;
  readonly sources: ExposureSources;
}) {
  const grade = toGrade(platform.confidence);
  const edges = pathEdges(platform, exposure);
  // Where a step has alternatives, the best-evidenced one set the grade, so a
  // weaker row below is not a contradiction. Said only when it can happen.
  const branching = edges.length > platform.via_components.length + 1;
  const label = [
    `${platform.name}.`,
    `Confidence ${GRADE_LABEL[grade].toLowerCase()},`,
    "the weakest link on the route from this mine's elements.",
    ...edges.map((e) => `${e.label}.`),
  ].join(" ");

  return (
    <ConfidenceDot grade={grade} subject={platform.name} label={label}>
      <p className="border-t border-surface-2 pt-1.5 text-[9px] leading-relaxed text-text-tertiary">
        The weakest link on the route from this mine&rsquo;s elements to this
        system, where each link is itself no stronger than the document under
        it. Not a joint probability: these assertions are not independent.
      </p>
      <div className="flex flex-col gap-1.5 border-t border-surface-2 pt-1.5">
        <span className="font-mono text-[9px] tracking-[0.15em] text-accent uppercase">
          What it rests on
        </span>
        {edges.map((edge) => (
          <PathEdgeRow key={edge.key} edge={edge} sources={sources} />
        ))}
      </div>
      {branching && (
        <p className="text-[9px] leading-relaxed text-text-tertiary">
          Where a step has more than one route, the best evidenced of them sets
          the grade.
        </p>
      )}
    </ConfidenceDot>
  );
}

// How many end uses to show before the rest go behind a disclosure. The panel
// is a decision aid, not a catalogue: at the current Dy/Tb scope a mine reaches
// fourteen platforms, which would push everything below "Why it matters" off
// the first screen.
const SYSTEMS_SHOWN = 5;

// Only the kinds a reader could over-read are labelled. A PLATFORM is the most
// specific claim the source can make and needs no qualifier; a CATEGORY names
// no single hull or airframe, and a SUBSYSTEM is a part of one, so both say so.
const KIND_LABEL: Record<string, string> = {
  SUBSYSTEM: "Subsystem",
  CATEGORY: "Class",
};

/** One end use, with the components that carry the mine's elements into it. */
function SystemRow({
  platform,
  exposure,
  sources,
}: {
  readonly platform: ApiPlatformExposure;
  readonly exposure: MineExposure;
  readonly sources: ExposureSources;
}) {
  const kind = KIND_LABEL[platform.kind];
  // Not the platform's own name: the parent is named only so a subsystem does
  // not read as a whole hull. The graph carries no claim that losing the
  // subsystem stops the parent, so the parent is not itself listed as at risk.
  const parent =
    platform.kind === "SUBSYSTEM" && platform.parent_name
      ? `of ${platform.parent_name}`
      : null;

  return (
    <li className="flex flex-col gap-0.5 border-t border-surface-2 px-1 py-2">
      <span className="flex items-baseline gap-1.5">
        <span className="text-xs font-semibold text-foreground">
          {platform.name}
        </span>
        {kind && <span className="tag tag-outline">{kind}</span>}
      </span>
      <span className="text-[10.5px] leading-snug text-text-secondary">
        via {platform.via_components.map((c) => c.name).join(", ")}
      </span>
      <span className="mt-0.5 flex flex-wrap items-center gap-1 font-mono text-[9px] tracking-[0.1em] text-text-tertiary uppercase">
        {parent && <span>{parent}</span>}
        {parent && <span>·</span>}
        {/* Exempt from the row's uppercase: element symbols are case-significant,
            and "DY" is not how dysprosium is written. */}
        <span className="normal-case">{platform.elements.join("/")}</span>
        <span>·</span>
        <PlatformConfidence
          platform={platform}
          exposure={exposure}
          sources={sources}
        />
      </span>
    </li>
  );
}

/**
 * End uses reached by the elements this mine puts into the chain.
 *
 * Replaces a stub, and deliberately does not replace it with a consequence
 * figure: sizing a shortfall needs a demand side, and the graph has none. What
 * it can say is which components cannot be built without this element and which
 * platform classes are asserted to need them — a statement about what is at
 * stake, not about how much.
 *
 * Two things the wording has to keep carrying. These are functional dependency
 * claims about *classes*: bills of material are classified, and nothing here
 * says metal from this mine reached a particular airframe. And it is not a
 * routed path — whether this mine's Dy ever reaches a separator is what the
 * disruption graph above answers, not this.
 */
export default function AffectedSystems({
  exposure,
  state,
}: {
  readonly exposure?: MineExposure;
  readonly state: "idle" | "loading" | "error";
}) {
  if (!exposure) {
    return (
      <p className="text-xs text-text-tertiary">
        {state === "loading"
          ? "Resolving end-use exposure…"
          : state === "error"
            ? "Could not reach the exposure API."
            : "No mine behind this alert, so no end use can be derived."}
      </p>
    );
  }

  const { platforms } = exposure;
  const sources: ExposureSources = new Map(
    exposure.sources.map((source) => [source.id, source]),
  );
  const shipped = exposure.source_materials.filter((m) => m.shipped);
  const shown = platforms.slice(0, SYSTEMS_SHOWN);
  const rest = platforms.slice(SYSTEMS_SHOWN);

  return (
    <div className="flex flex-col gap-1.5 border border-surface-2 px-3 py-2.5">
      <p className="text-xs leading-relaxed text-foreground">
        <span className="font-mono text-sm font-semibold text-accent tabular-nums">
          {platforms.length}
        </span>{" "}
        weapons system{platforms.length === 1 ? "" : "s"} depend on{" "}
        {exposure.elements.join(" and ")}
      </p>
      {shipped.length > 0 && (
        <p className="font-mono text-[9px] leading-relaxed text-text-tertiary">
          Carried in{" "}
          {shipped.map((m) => m.material_name ?? m.material_id).join(", ")}.
        </p>
      )}

      {platforms.length === 0 ? (
        <p className="text-[10.5px] leading-relaxed text-text-secondary">
          No modelled component requires what this mine carries. The end-use
          layer is incomplete, not empty.
        </p>
      ) : (
        <>
          <ul className="flex flex-col">
            {shown.map((platform) => (
              <SystemRow
                key={platform.platform_id}
                platform={platform}
                exposure={exposure}
                sources={sources}
              />
            ))}
          </ul>
          {rest.length > 0 && (
            <details className="disclosure flex flex-col">
              <summary className="flex cursor-pointer items-center justify-between gap-2 border-t border-surface-2 pt-2 font-mono text-[9px] tracking-[0.15em] text-text-tertiary uppercase transition-colors hover:text-accent">
                <span
                  aria-hidden
                  className="disclosure-caret text-[15px] leading-none text-accent"
                >
                  ▼
                </span>
                <span className="when-closed">
                  The other {rest.length}, less specific
                </span>
                <span className="when-open">Hide the other {rest.length}</span>
                <span
                  aria-hidden
                  className="disclosure-caret text-[15px] leading-none text-accent"
                >
                  ▼
                </span>
              </summary>
              <ul className="flex flex-col">
                {rest.map((platform) => (
                  <SystemRow
                    key={platform.platform_id}
                    platform={platform}
                    exposure={exposure}
                    sources={sources}
                  />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
