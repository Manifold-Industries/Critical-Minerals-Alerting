"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { ApiProvenance, ApiSourceRef } from "@/lib/monitor/api";
import {
  checkedLine,
  displayedConfidence,
  whyLine,
  GRADE_FILL,
  GRADE_LABEL,
  GRADE_TERM,
  GRADE_VAR,
  HOW_ENTRY,
  NO_CLAIM,
  UNSOURCED_SOURCE_NOTE,
  type ConfidenceGrade,
  type DisplayedConfidence,
} from "@/lib/monitor/provenance";

const CARD_WIDTH = 340;
const CARD_MARGIN = 24;
const GAP = 8;
/** Vertical clearance between the trigger row and the card. */
const CARD_GAP = 10;
/** The pointer has to cross open space to reach the card, so it survives a
 *  brief exit rather than vanishing mid-travel. */
const CLOSE_DELAY_MS = 140;
/** A hover card is a glance, not a reading surface. Locators run to paragraphs
 *  and the bibliography at the foot of the panel is where they are read in
 *  full. */
const CARD_MAX_HEIGHT = 400;

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
 * The mark itself: a circle whose hue and filled area both carry the grade —
 * full disc for high, half for moderate, quarter for low.
 *
 * The faint rim is always the whole circle, so a quarter-filled dot reads as a
 * quarter *of something* rather than as a small dot. An unrated grade — and a
 * field with no claim at all — gets a dashed rim and no fill: visibly a
 * question rather than a low score.
 *
 * `hueEncoding` off swaps the grade hues for the single accent, for contexts
 * where three hues are noise; the fill fraction still carries the grade.
 */
export function ConfidencePie({
  grade,
  size = 10,
  hueEncoding = true,
}: {
  readonly grade: ConfidenceGrade;
  readonly size?: number;
  readonly hueEncoding?: boolean;
}) {
  const fill = GRADE_FILL[grade];
  const color = hueEncoding ? `var(${GRADE_VAR[grade]})` : "var(--color-accent)";
  const empty = fill === 0;
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
        strokeDasharray={empty ? "1.7 1.7" : undefined}
        opacity={empty ? 0.85 : 0.4}
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
  /** Exactly one of `top` / `bottom` is set, so the card grows away from the
   *  nearer viewport edge instead of being clipped by it. */
  readonly top?: number;
  readonly bottom?: number;
  readonly maxHeight: number;
}

/** Below the trigger row, aligned to the value; above only where the viewport
 *  leaves no room underneath. */
function placeCard(rect: DOMRect): Placement {
  const width = Math.min(CARD_WIDTH, window.innerWidth - 2 * CARD_MARGIN);
  const left = Math.max(
    CARD_MARGIN,
    Math.min(rect.left, window.innerWidth - CARD_MARGIN - width),
  );
  const roomBelow = window.innerHeight - rect.bottom - CARD_GAP - GAP;
  if (roomBelow >= Math.min(CARD_MAX_HEIGHT, rect.top)) {
    return {
      left,
      top: rect.bottom + CARD_GAP,
      maxHeight: Math.min(roomBelow, CARD_MAX_HEIGHT),
    };
  }
  return {
    left,
    bottom: window.innerHeight - rect.top + CARD_GAP,
    maxHeight: Math.min(rect.top - CARD_GAP - GAP, CARD_MAX_HEIGHT),
  };
}

interface HoverCardState {
  readonly placement: Placement;
  readonly pinned: boolean;
}

/**
 * Open, close and pin for one hover card and its trigger.
 *
 * Open state *is* the placement: the trigger's rect is readable synchronously
 * in the event that opens the card, so there is no unpositioned state to
 * represent and no stale placement left over from the last trigger. Hover and
 * focus open; leave and blur close after a grace period; click pins, so the
 * card survives on touch devices; Escape, an outside press or a second click
 * dismiss it.
 */
function useHoverCard() {
  const [state, setState] = useState<HoverCardState | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const open = state !== null;
  const pinned = state?.pinned ?? false;

  const cancelClose = useCallback(() => clearTimeout(closeTimer.current), []);
  const close = useCallback(() => setState(null), []);
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(
      // Read pinned at fire time, not capture time: the user may pin the card
      // during the grace period the timer grants.
      () => setState((s) => (s?.pinned ? s : null)),
      CLOSE_DELAY_MS,
    );
  }, [cancelClose]);

  /** Opens the card, and keeps it aligned to the trigger thereafter. */
  const syncPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect)
      setState((s) => ({ placement: placeCard(rect), pinned: s?.pinned ?? false }));
  }, []);

  /** Click: pin an open or closed card, dismiss a pinned one. */
  const togglePin = useCallback(() => {
    setState((s) => {
      if (s?.pinned) return null;
      const rect = triggerRef.current?.getBoundingClientRect();
      return rect ? { placement: placeCard(rect), pinned: true } : s;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      triggerRef.current?.focus();
    };
    // A pinned card outlives hover, so an outside press is its dismissal — a
    // press on the card itself (its source link, say) is not outside.
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !cardRef.current?.contains(target)
      )
        close();
    };
    // Capture, so scrolling the panel this sits inside moves the card with it
    // rather than leaving it stranded beside a row that has moved on.
    window.addEventListener("scroll", syncPosition, true);
    window.addEventListener("resize", syncPosition);
    window.addEventListener("keydown", onKey);
    if (pinned) window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("scroll", syncPosition, true);
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, pinned, syncPosition, close]);

  useEffect(() => cancelClose, [cancelClose]);

  return {
    state,
    open,
    pinned,
    triggerRef,
    cardRef,
    cancelClose,
    scheduleClose,
    syncPosition,
    togglePin,
  };
}

/** The non-ref part of `useHoverCard`'s return, safe to read during render. */
interface HoverCardControls {
  readonly open: boolean;
  readonly cancelClose: () => void;
  readonly scheduleClose: () => void;
  readonly syncPosition: () => void;
  readonly togglePin: () => void;
}

/** The value-shaped trigger: dashed underline that says "there is more here",
 *  amber tint while the card is open. */
function triggerClass(open: boolean): string {
  return `inline-flex max-w-full cursor-help items-baseline gap-1 border-b border-dashed text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
    open
      ? "border-accent bg-accent-tint"
      : "border-text-tertiary hover:border-accent hover:bg-accent-tint"
  }`;
}

/** Event handlers every trigger shares. */
function triggerHandlers({
  open,
  cancelClose,
  scheduleClose,
  syncPosition,
  togglePin,
}: HoverCardControls) {
  return {
    onClick: togglePin,
    onPointerEnter: () => {
      cancelClose();
      if (!open) syncPosition();
    },
    onPointerLeave: scheduleClose,
    onFocus: () => {
      cancelClose();
      if (!open) syncPosition();
    },
    onBlur: scheduleClose,
  };
}

/**
 * The card chrome every provenance surface shares: blueprint frame, opaque
 * fill (unlike the translucent panels — the card sits over data rows and has
 * to read against them), and the grade header. Bodies differ per surface.
 *
 * Decorative as far as assistive tech is concerned: every trigger's own label
 * states the whole of its card, which is what lets the card stay out of the
 * accessibility tree.
 */
function HoverCardShell({
  state,
  cardRef,
  cancelClose,
  scheduleClose,
  grade,
  hueEncoding = true,
  children,
}: {
  readonly state: HoverCardState | null;
  readonly cardRef: React.RefObject<HTMLDivElement | null>;
  readonly cancelClose: () => void;
  readonly scheduleClose: () => void;
  readonly grade: ConfidenceGrade;
  readonly hueEncoding?: boolean;
  readonly children: React.ReactNode;
}) {
  if (!state || typeof document === "undefined") return null;
  const { placement } = state;
  return createPortal(
    <div
      ref={cardRef}
      aria-hidden="true"
      onPointerEnter={cancelClose}
      onPointerLeave={scheduleClose}
      style={{
        left: placement.left,
        top: placement.top,
        bottom: placement.bottom,
        width: CARD_WIDTH,
        maxWidth: "calc(100vw - 48px)",
        maxHeight: placement.maxHeight,
      }}
      className="blueprint fixed z-50 flex flex-col gap-2.5 overflow-y-auto p-3 shadow-[0_2px_16px_rgba(0,0,0,0.6)]"
    >
      <p className="flex items-center gap-2">
        <ConfidencePie grade={grade} size={14} hueEncoding={hueEncoding} />
        <span
          className="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase"
          style={{ color: `var(${GRADE_VAR[grade]})` }}
        >
          {GRADE_TERM[grade]}
        </span>
      </p>
      {children}
    </div>,
    document.body,
  );
}

export interface ConfidenceDotProps {
  readonly grade: ConfidenceGrade;
  /** What the claim is about. Heads the card body and opens the label. */
  readonly subject: string;
  /** The whole of the card in words. Assistive tech reads this and never the
   *  card, which is why it has to carry the substance rather than a name. */
  readonly label: string;
  /** Trigger text after the dot, e.g. the grade term. Without it the trigger
   *  is the bare dot. */
  readonly triggerText?: string;
  /** Card body, under the grade header and subject line. */
  readonly children: React.ReactNode;
}

/**
 * A confidence mark with detail on hover, focus or click.
 *
 * Knows nothing about what it is grading. `AttestedValue` grades one assertion;
 * the decision panel grades a path of them. Both draw the same mark and the
 * same card chrome, and only the body differs.
 */
export function ConfidenceDot({
  grade,
  subject,
  label,
  triggerText,
  children,
}: ConfidenceDotProps) {
  const { state, open, triggerRef, cardRef, ...controls } = useHoverCard();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        className={
          triggerText
            ? triggerClass(open)
            : // Negative margin keeps the 22px hit target from stretching a 9px
              // meta line, which is the only reason those rows fit as densely
              // as they do.
              "-m-1.5 inline-flex cursor-help p-1.5 align-middle"
        }
        {...triggerHandlers({ open, ...controls })}
      >
        <span className={triggerText ? "self-center" : undefined}>
          <ConfidencePie grade={grade} />
        </span>
        {triggerText && <span className="min-w-0">{triggerText}</span>}
      </button>

      <HoverCardShell
        state={state}
        cardRef={cardRef}
        cancelClose={controls.cancelClose}
        scheduleClose={controls.scheduleClose}
        grade={grade}
      >
        <p className="text-[10.5px] leading-snug font-semibold text-foreground">
          {subject}
        </p>
        {children}
      </HoverCardShell>
    </>
  );
}

/** One labelled row of the card's definition grid. */
function CardRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <>
      <dt className="pt-px font-mono text-[9px] tracking-[0.1em] text-accent uppercase">
        {label}
      </dt>
      <dd className="flex min-w-0 flex-col gap-0.5 text-[10px] leading-relaxed text-text-secondary">
        {children}
      </dd>
    </>
  );
}

/** The Source row: bold title, publisher and date, locator. */
function CardSource({
  source,
  citation,
}: {
  readonly source: ApiSourceRef;
  readonly citation?: number;
}) {
  const title = (
    <span className="font-semibold text-foreground">
      {source.name}
      {citation != null && (
        <span className="ml-1 font-mono text-[9px] font-normal text-accent">
          [{citation}]
        </span>
      )}
    </span>
  );
  return (
    <>
      {/* An unanchored source is text, never a dead link. The card is
          aria-hidden, and a focusable element inside an aria-hidden subtree is
          a WCAG 4.1.2 failure (axe aria-hidden-focus), so the link leaves the
          tab order; the same document is a keyboard-reachable entry in the
          numbered bibliography at the foot of the asset panel. */}
      {source.url ? (
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          tabIndex={-1}
          className="underline decoration-surface-2 underline-offset-2 transition-colors hover:decoration-accent"
        >
          {title}
        </a>
      ) : (
        title
      )}
      <span className="font-mono text-[9px] tracking-[0.05em] text-text-tertiary">
        {[source.publisher, source.published_on].filter(Boolean).join(" · ") ||
          "Publisher and date not recorded"}
      </span>
      <span className="line-clamp-2 font-mono text-[9px] leading-relaxed text-text-tertiary/70">
        {source.locator ?? "No page or table reference"}
      </span>
    </>
  );
}

export interface AttestedValueProps {
  /** The assertion behind the value. Null renders the not-disclosed state: the
   *  card still opens and says why the field is empty. */
  readonly provenance: ApiProvenance | null | undefined;
  /** The document `provenance.source_id` resolves to, where it names one.
   *  Passing nothing for a provenance that *does* cite a source grades the
   *  value on the assertion alone, so resolve it wherever you can. */
  readonly source?: ApiSourceRef | null;
  /** Citation number of `source` within the panel's bibliography, so the card
   *  points at the same entry the footnote marker does. */
  readonly citation?: number;
  /** What the claim is about, e.g. "Dy oxide · 288 t/yr". Read to assistive
   *  tech, which never sees the card. */
  readonly subject: string;
  /** Unit text set after the value, muted. */
  readonly unit?: string;
  /** Encode the grade in hue as well as fill. Off swaps the hues for the
   *  accent; the fill fraction still carries the grade. */
  readonly hueEncoding?: boolean;
  /** Show the Claim / Document footer tags, so both inputs stay visible even
   *  though only the minimum is graded. */
  readonly showBothRatings?: boolean;
  /** The value itself. Omit for a field the graph holds nothing for. */
  readonly children?: React.ReactNode;
}

/**
 * An attested value: a confidence dot, the value, and a hover card that says
 * how much to trust it, how it was produced, which document it came from, and
 * whether a human has checked it.
 *
 * Nothing here is reachable only by hovering: the trigger's own label states
 * the whole of the card, and every source it can show is also a numbered entry
 * in the bibliography at the foot of the panel, in DOM order and in the tab
 * order.
 */
export function AttestedValue({
  provenance,
  source,
  citation,
  subject,
  unit,
  hueEncoding = true,
  showBothRatings = true,
  children,
}: AttestedValueProps) {
  const { state, open, triggerRef, cardRef, ...controls } = useHoverCard();

  const conf: DisplayedConfidence = provenance
    ? displayedConfidence(provenance, source)
    : NO_CLAIM;
  const noClaim = conf.grade === "NO_CLAIM";
  const howKey = noClaim ? "NO_CLAIM" : (provenance?.type ?? "UNKNOWN");
  const how = HOW_ENTRY[howKey] ?? HOW_ENTRY.UNKNOWN;
  const why = whyLine(conf);
  const checked = checkedLine(noClaim ? null : (provenance ?? null));
  const showSource = !noClaim && conf.source !== null && source;
  const unsourcedNote =
    UNSOURCED_SOURCE_NOTE[howKey] ?? UNSOURCED_SOURCE_NOTE.UNKNOWN;

  const label = [
    `${subject}.`,
    `${GRADE_TERM[conf.grade]}.`,
    why,
    `${how.word}. ${how.gloss}`,
    showSource ? `Source: ${source.name}.` : unsourcedNote,
    checked,
  ].join(" ");

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        className={triggerClass(open)}
        {...triggerHandlers({ open, ...controls })}
      >
        <span className="self-center">
          <ConfidencePie grade={conf.grade} hueEncoding={hueEncoding} />
        </span>
        {children != null ? (
          <span className="min-w-0">{children}</span>
        ) : (
          <span className="text-text-tertiary italic normal-case">
            not disclosed
          </span>
        )}
        {unit && (
          <span className="font-mono text-[9px] text-text-tertiary">{unit}</span>
        )}
      </button>

      <HoverCardShell
        state={state}
        cardRef={cardRef}
        cancelClose={controls.cancelClose}
        scheduleClose={controls.scheduleClose}
        grade={conf.grade}
        hueEncoding={hueEncoding}
      >
        {/* Which input set the grade, before any detail. */}
        <p className="text-[10px] leading-relaxed text-text-secondary">{why}</p>

        <dl className="grid grid-cols-[72px_1fr] gap-x-2.5 gap-y-2 border-t border-surface-2 pt-2.5">
          <CardRow label="How">
            <span>
              <span className="font-semibold text-foreground">{how.word}.</span>{" "}
              {how.gloss}
            </span>
          </CardRow>
          <CardRow label="Source">
            {showSource ? (
              <CardSource source={source} citation={citation} />
            ) : (
              <span>{unsourcedNote}</span>
            )}
          </CardRow>
          <CardRow label="Checked">
            <span>{checked}</span>
          </CardRow>
        </dl>

        {/* Both inputs stay visible even though only the minimum is graded. */}
        {showBothRatings && !noClaim && (
          <p className="flex gap-1.5 border-t border-surface-2 pt-2.5">
            <span className="tag tag-neutral">
              Claim: {GRADE_LABEL[conf.assertion]}
            </span>
            {conf.source !== null && (
              <span className="tag tag-neutral">
                Document: {GRADE_LABEL[conf.source]}
              </span>
            )}
          </p>
        )}
      </HoverCardShell>
    </>
  );
}

/**
 * Page-level legend for the confidence dots. One per panel that renders them,
 * at the foot, so the marks are decodable without opening a card.
 */
export function ProvenanceLegend() {
  const grades: readonly ConfidenceGrade[] = ["HIGH", "MEDIUM", "LOW", "UNRATED"];
  return (
    <div className="flex flex-col gap-1 border-t border-surface-2 pt-2">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {grades.map((grade) => (
          <span
            key={grade}
            className="inline-flex items-center gap-1 font-mono text-[9px] tracking-[0.1em] text-text-tertiary uppercase"
          >
            <ConfidencePie grade={grade} size={9} />
            {GRADE_LABEL[grade]}
          </span>
        ))}
      </div>
      <p className="text-[9px] leading-relaxed text-text-tertiary">
        Confidence terms follow ICD-203. The grade is the weaker of the claim
        and its document.
      </p>
    </div>
  );
}
