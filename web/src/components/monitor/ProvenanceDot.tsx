"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { ApiProvenance, ApiSourceRef } from "@/lib/monitor/api";
import {
  displayedConfidence,
  humanise,
  GRADE_FILL,
  GRADE_LABEL,
  GRADE_VAR,
  UNSOURCED_NOTE,
  type ConfidenceGrade,
} from "@/lib/monitor/provenance";

const POPOVER_WIDTH = 268;
const GAP = 8;
/** The pointer has to cross open space to reach the source link, so the popover
 *  survives a brief exit rather than vanishing mid-travel. */
const CLOSE_DELAY_MS = 140;
/** A popover is a glance, not a reading surface. Locators run to paragraphs and
 *  the bibliography at the foot of the panel is where they are read in full. */
const POPOVER_MAX_HEIGHT = 400;

/**
 * Pie wedge from twelve o'clock, clockwise. Only for fractions strictly between
 * 0 and 1 — a full circle is degenerate as an arc and is drawn as a circle.
 */
function wedge(cx: number, cy: number, r: number, fraction: number): string {
  const a = fraction * 2 * Math.PI;
  const x = cx + r * Math.sin(a);
  const y = cy - r * Math.cos(a);
  return `M${cx} ${cy}L${cx} ${cy - r}A${r} ${r} 0 ${fraction > 0.5 ? 1 : 0} 1 ${x} ${y}Z`;
}

/**
 * The mark itself: a circle whose hue and filled area both carry the grade.
 *
 * The faint rim is always the whole circle, so a quarter-filled dot reads as a
 * quarter *of something* rather than as a small dot. An unrated grade gets a
 * dashed rim and no fill — visibly a question rather than a low score.
 */
export function ConfidencePie({
  grade,
  size = 10,
}: {
  readonly grade: ConfidenceGrade;
  readonly size?: number;
}) {
  const fill = GRADE_FILL[grade];
  const color = `var(${GRADE_VAR[grade]})`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      aria-hidden="true"
      focusable="false"
      className="block shrink-0"
    >
      <circle
        cx="6"
        cy="6"
        r="5"
        fill="none"
        stroke={color}
        strokeWidth="1.25"
        strokeDasharray={grade === "UNRATED" ? "1.7 1.7" : undefined}
        opacity={grade === "UNRATED" ? 0.85 : 0.4}
      />
      {fill >= 1 ? (
        <circle cx="6" cy="6" r="5" fill={color} />
      ) : fill > 0 ? (
        <path d={wedge(6, 6, 5, fill)} fill={color} />
      ) : null}
    </svg>
  );
}

interface Placement {
  readonly left: number;
  /** Exactly one of `top` / `bottom` is set, so the popover grows away from the
   *  nearer viewport edge instead of being clipped by it. */
  readonly top?: number;
  readonly bottom?: number;
  readonly maxHeight: number;
}

function place(rect: DOMRect): Placement {
  // The panel this lives in is anchored bottom-right, so the room is to the
  // left. Flip only where there genuinely is not any.
  const leftOf = rect.left - GAP - POPOVER_WIDTH;
  const left =
    leftOf >= GAP
      ? leftOf
      : Math.min(rect.right + GAP, window.innerWidth - GAP - POPOVER_WIDTH);
  const growUp = rect.top > window.innerHeight / 2;
  return growUp
    ? {
        left,
        bottom: window.innerHeight - rect.bottom - 4,
        maxHeight: Math.min(rect.bottom + 4 - GAP, POPOVER_MAX_HEIGHT),
      }
    : {
        left,
        top: rect.top - 4,
        maxHeight: Math.min(
          window.innerHeight - rect.top + 4 - GAP,
          POPOVER_MAX_HEIGHT,
        ),
      };
}

export function DetailRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <>
      <dt className="text-text-tertiary uppercase">{label}</dt>
      <dd className="text-text-secondary">{value}</dd>
    </>
  );
}

/**
 * The document a claim rests on: what it is, who published it, and where in it
 * to look. Shared, because the decision panel cites the same documents the info
 * panel does.
 */
export function SourceBlock({
  source,
  citation,
}: {
  readonly source: ApiSourceRef;
  readonly citation?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-surface-2 pt-1.5">
      <span className="font-mono text-[9px] tracking-[0.15em] text-accent uppercase">
        Source{citation != null ? ` [${citation}]` : ""}
      </span>
      {/* An unanchored source is text, never a dead link. */}
      {source.url ? (
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          // The popover is aria-hidden, and a focusable element inside an
          // aria-hidden subtree is a WCAG 4.1.2 failure (axe aria-hidden-focus).
          // Taking it out of the tab order resolves that without stranding the
          // link: the same document is a keyboard-reachable entry in the
          // numbered bibliography at the foot of the asset panel.
          tabIndex={-1}
          className="text-[10px] leading-snug text-text-secondary underline decoration-surface-2 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
        >
          {source.name}
        </a>
      ) : (
        <span className="text-[10px] leading-snug text-text-secondary">
          {source.name}
        </span>
      )}
      <span className="font-mono text-[9px] tracking-[0.05em] text-text-tertiary">
        {[
          source.publisher,
          source.published_on,
          humanise(source.source_type),
          source.source_confidence
            ? `Source ${source.source_confidence.toLowerCase()}`
            : "Source unrated",
          source.url ? null : "No retrievable location",
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
      {source.locator && (
        <span className="mt-0.5 line-clamp-2 font-mono text-[9px] leading-relaxed text-text-tertiary/70">
          {source.locator}
        </span>
      )}
    </div>
  );
}

export interface ConfidenceDotProps {
  readonly grade: ConfidenceGrade;
  /** What the claim is about. Heads the popover and opens the label. */
  readonly subject: string;
  /** The whole of the popover in words. Assistive tech reads this and never the
   *  popover, which is why it has to carry the substance rather than a name. */
  readonly label: string;
  /** Popover body, under the subject and grade lines. */
  readonly children: React.ReactNode;
}

/**
 * A confidence mark with detail on hover, focus or click.
 *
 * Knows nothing about what it is grading. `ProvenanceDot` grades one assertion;
 * the decision panel grades a path of them. Both draw the same mark and the
 * same popover chrome, and only the body differs.
 */
export function ConfidenceDot({
  grade,
  subject,
  label,
  children,
}: ConfidenceDotProps) {
  // Open state *is* the placement: the trigger's rect is readable synchronously
  // in the event that opens the popover, so there is no unpositioned state to
  // represent and no stale placement left over from the last trigger.
  const [placement, setPlacement] = useState<Placement | null>(null);
  const open = placement !== null;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const cancelClose = useCallback(() => clearTimeout(closeTimer.current), []);
  const close = useCallback(() => setPlacement(null), []);
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(close, CLOSE_DELAY_MS);
  }, [cancelClose, close]);

  /** Opens the popover, and keeps it pinned to the trigger thereafter. */
  const syncPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPlacement(place(rect));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      triggerRef.current?.focus();
    };
    // Capture, so scrolling the panel this sits inside moves the popover with
    // it rather than leaving it stranded beside a row that has moved on.
    window.addEventListener("scroll", syncPosition, true);
    window.addEventListener("resize", syncPosition);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", syncPosition, true);
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, syncPosition, close]);

  useEffect(() => cancelClose, [cancelClose]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        // Negative margin keeps the 22px hit target from stretching a 9px meta
        // line, which is the only reason these rows fit as densely as they do.
        className="-m-1.5 inline-flex cursor-help p-1.5 align-middle"
        aria-label={label}
        aria-expanded={open}
        // Click toggles as well as hover, so a touch user can open it at all
        // and a second tap dismisses it.
        onClick={() => (open ? close() : syncPosition())}
        onPointerEnter={() => {
          cancelClose();
          syncPosition();
        }}
        onPointerLeave={scheduleClose}
        onFocus={() => {
          cancelClose();
          syncPosition();
        }}
        onBlur={scheduleClose}
      >
        <ConfidencePie grade={grade} />
      </button>

      {placement &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            aria-hidden="true"
            onPointerEnter={cancelClose}
            onPointerLeave={scheduleClose}
            style={{
              left: placement.left,
              top: placement.top,
              bottom: placement.bottom,
              width: POPOVER_WIDTH,
              maxHeight: placement.maxHeight,
            }}
            className="fixed z-50 flex flex-col gap-1.5 overflow-y-auto border border-surface-2 bg-surface-1/98 p-2.5 shadow-[0_2px_16px_rgba(0,0,0,0.6)] backdrop-blur-sm"
          >
            <p className="text-[10.5px] leading-snug font-semibold text-foreground">
              {subject}
            </p>
            <p className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.15em] uppercase">
              <ConfidencePie grade={grade} size={11} />
              <span style={{ color: `var(${GRADE_VAR[grade]})` }}>
                {GRADE_LABEL[grade]} confidence
              </span>
            </p>
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}

export interface ProvenanceDotProps {
  readonly provenance: ApiProvenance | null | undefined;
  /** The document `provenance.source_id` resolves to, where it names one.
   *  Passing nothing for a provenance that *does* cite a source grades the dot
   *  on the assertion alone, so resolve it wherever you can. */
  readonly source?: ApiSourceRef | null;
  /** Citation number of `source` within the panel's bibliography, so the
   *  popover points at the same entry the footnote marker does. */
  readonly citation?: number;
  /** What the claim is about, e.g. "Dy oxide · 288 t/yr". Named in the popover
   *  and in the accessible label so neither is stranded from its subject. */
  readonly subject: string;
}

/**
 * Confidence in one assertion, as a filled circle with the detail on hover.
 *
 * Renders for every assertion, including those citing no document — unlike the
 * footnote marker beside it, which correctly renders nothing there. The two
 * answer different questions: the dot is "how much do I trust this", the
 * footnote is "where do I check it". A judgment and an automated inference have
 * an answer to the first and none to the second, and were previously invisible.
 *
 * The popover is decorative as far as assistive tech is concerned: the button's
 * own label states the whole of it, and every source it can show is also a
 * numbered entry in the bibliography at the foot of the panel, in DOM order and
 * in the tab order. Nothing here is reachable only by hovering, which is what
 * lets the popover itself stay out of the accessibility tree.
 */export default function ProvenanceDot({
  provenance,
  source,
  citation,
  subject,
}: ProvenanceDotProps) {
  if (!provenance) return null;

  const conf = displayedConfidence(provenance, source);
  const type = humanise(provenance.type);
  const unsourced = conf.source === null;

  const label = [
    `${subject}.`,
    `Confidence ${GRADE_LABEL[conf.grade].toLowerCase()}.`,
    unsourced
      ? `Assertion ${GRADE_LABEL[conf.assertion].toLowerCase()}, resting on no document. ${type}.`
      : `Assertion ${GRADE_LABEL[conf.assertion].toLowerCase()}, source ${GRADE_LABEL[
          conf.source
        ].toLowerCase()}. ${type}, ${source?.name ?? "source unresolved"}.`,
    provenance.unverified_model_extraction
      ? unsourced
        ? "Model-authored and unreviewed."
        : "Not verified against the document."
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <ConfidenceDot grade={conf.grade} subject={subject} label={label}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5 border-t border-surface-2 pt-1.5 font-mono text-[9px] tracking-[0.05em]">
        <DetailRow label="Assertion" value={GRADE_LABEL[conf.assertion]} />
        {conf.source !== null && (
          <DetailRow label="Source" value={GRADE_LABEL[conf.source]} />
        )}
        <DetailRow label="Type" value={type} />
      </dl>

      {/* The two ratings are not interchangeable, and the panel says so rather
          than trusting the layout to imply it. Only where they disagree: on
          every row it was wallpaper. */}
      {!unsourced && conf.binding !== "BOTH" && (
        <p className="text-[9px] leading-relaxed text-text-tertiary">
          Assertion rates the conclusion drawn; source rates the document it was
          drawn from. The dot takes the weaker of the two.
        </p>
      )}

      {unsourced ? (
        <p className="border-t border-surface-2 pt-1.5 text-[9px] leading-relaxed text-text-tertiary">
          <span className="text-accent">No document.</span>{" "}
          {UNSOURCED_NOTE[provenance.type] ?? UNSOURCED_NOTE.UNKNOWN}
        </p>
      ) : (
        source && <SourceBlock source={source} citation={citation} />
      )}

      {provenance.unverified_model_extraction && (
        <p className="border-t border-surface-2 pt-1.5 text-[9px] leading-relaxed text-text-tertiary">
          <span className="text-accent">Unverified.</span>{" "}
          {unsourced
            ? "A model produced this and nobody has reviewed it."
            : "A model read this out of the source and nobody has checked it against the document."}
        </p>
      )}
    </ConfidenceDot>
  );
}
