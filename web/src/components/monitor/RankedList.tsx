import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { factorName, factorShade } from "@/lib/monitor/factors";
import type { AlternativeSource } from "@/lib/monitor/graphs";

interface RankedListProps {
  readonly alternatives: readonly AlternativeSource[];
  /** Factor ids the ranking was struck on; only these are printed and drawn. */
  readonly factors: readonly string[];
  /** Name of the plant each source would feed, by node id. */
  readonly feedsName: (nodeId: string) => string | undefined;
  /** Bumped on every Rank click, so the sweep replays even when the order
   *  happens not to change. */
  readonly run: number;
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (id: string) => void;
}

const MOVE_MS = 450;
const COUNT_MS = 700;
/** Delay between one row's entrance and the next. */
const STAGGER_MS = 70;
const EASE_OUT = "cubic-bezier(0.2, 0.8, 0.2, 1)";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Slide rows from where they were to where they now are (FLIP).
 *
 * `offsetTop` rather than a bounding rect: it ignores both the panel's scroll
 * position and any transform still in flight, so a re-rank during a move starts
 * from the row's true slot. The Web Animations API leaves no inline style to
 * clean up afterwards.
 */
function useSlideOnReorder(order: string) {
  const listRef = useRef<HTMLUListElement>(null);
  const tops = useRef<ReadonlyMap<string, number>>(new Map());

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const still = prefersReducedMotion();
    const next = new Map<string, number>();
    for (const row of Array.from(list.children)) {
      if (!(row instanceof HTMLElement) || !row.dataset.rowId) continue;
      const top = row.offsetTop;
      next.set(row.dataset.rowId, top);
      const before = tops.current.get(row.dataset.rowId);
      if (still || before === undefined || before === top) continue;
      row.animate(
        [{ transform: `translateY(${before - top}px)` }, { transform: "none" }],
        { duration: MOVE_MS, easing: EASE_OUT },
      );
    }
    tops.current = next;
  }, [order]);

  return listRef;
}

/** Ease a number towards `target`, from wherever it last stood. */
function useCountUp(target: number): number {
  const [shown, setShown] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const from = latest.current;
    const started = performance.now();
    const still = prefersReducedMotion();
    let frame = 0;
    const step = (now: number) => {
      const t = still ? 1 : Math.min((now - started) / COUNT_MS, 1);
      const value = from + (target - from) * (1 - (1 - t) ** 3);
      latest.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return shown;
}

/** How a row moved against the ranking before this one. */
function Movement({
  rank,
  previous,
}: {
  readonly rank: number;
  /** Undefined where there was no earlier ranking; null where there was one
   *  and this source was not in it. */
  readonly previous: number | null | undefined;
}) {
  if (previous === undefined || previous === rank) return null;
  if (previous === null) {
    return <span className="rank-delta text-accent">New</span>;
  }
  const places = Math.abs(previous - rank);
  return previous > rank ? (
    <span className="rank-delta text-accent">+{places}</span>
  ) : (
    <span className="rank-delta text-text-tertiary">−{places}</span>
  );
}

function RankedRow({
  alt,
  feedsName,
  factors,
  previousRank,
  active,
  onSelect,
}: {
  readonly alt: AlternativeSource;
  readonly feedsName?: string;
  readonly factors: readonly string[];
  readonly previousRank: number | null | undefined;
  readonly active: boolean;
  readonly onSelect: () => void;
}) {
  const used = (alt.scoreFactors ?? []).filter((f) =>
    factors.includes(f.factor),
  );
  const score = useCountUp(alt.score ?? 0);
  const enterDelay = `${(alt.rank - 1) * STAGGER_MS}ms`;

  return (
    <li
      data-row-id={alt.id}
      className="rank-row border-t border-surface-2"
      style={{ animationDelay: enterDelay }}
    >
      <button
        type="button"
        onClick={onSelect}
        title="Show this asset's reference detail"
        className={`grid w-full cursor-pointer grid-cols-[18px_1fr_auto] items-baseline gap-2 px-1 py-2 text-left transition-colors ${
          active ? "bg-accent-tint" : "hover:bg-ghost-hover"
        }`}
      >
        <span className="font-mono text-[13px] font-semibold text-accent tabular-nums">
          {alt.rank}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-baseline gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              {alt.name}
            </span>
            {/* Keyed by rank so the mark replays each time the row moves. */}
            <Movement key={alt.rank} rank={alt.rank} previous={previousRank} />
          </span>
          <span className="text-[10.5px] text-text-secondary">
            {alt.country}
            {feedsName ? ` · feeds ${feedsName}` : ""}
          </span>
          {used.length > 0 && (
            <span className="font-mono text-[9px] tracking-[0.1em] text-text-tertiary uppercase">
              {/* "?" marks a fallback, so a guess never reads as a disclosure. */}
              {used
                .map((f) => `${f.label.replace(/_/g, " ")}${f.known ? "" : " ?"}`)
                .join(" · ")}
            </span>
          )}
          {used.length > 0 && (
            // The score, taken apart: one segment per weighted factor, each as
            // wide as the points it earned, on a track of the 100 available.
            <span aria-hidden className="mt-1 block h-[3px] w-full bg-surface-2">
              <span
                className="rank-bar flex h-full"
                style={{ animationDelay: enterDelay }}
              >
                {used.map((f) => (
                  <span
                    key={f.factor}
                    className="rank-bar-segment h-full"
                    title={`${factorName(f.factor)}: ${f.contribution.toFixed(0)} of ${f.maxContribution.toFixed(0)} points`}
                    style={{
                      width: `${f.contribution}%`,
                      background: factorShade(f.factor),
                    }}
                  />
                ))}
              </span>
            </span>
          )}
        </span>
        {alt.score != null && (
          <span
            className="font-mono text-[11px] font-semibold text-foreground tabular-nums"
            title={`Score ${alt.score.toFixed(0)} of 100 under the weights above`}
          >
            {score.toFixed(0)}
          </span>
        )}
      </button>
    </li>
  );
}

/**
 * The ranked sources, animated so a re-rank reads as a change rather than as a
 * different list: rows that stay slide to their new place, rows that arrive
 * cascade in, and each score counts to its new value while its bar refills.
 *
 * Every motion is decoration over a list that is already correct in the DOM,
 * and all of it stands down under `prefers-reduced-motion`.
 */
export default function RankedList({
  alternatives,
  factors,
  feedsName,
  run,
  selectedNodeId,
  onSelectNode,
}: RankedListProps) {
  const order = alternatives.map((alt) => alt.id).join("|");
  const listRef = useSlideOnReorder(order);

  // The ranking before this one, kept so each row can say how far it moved.
  // Adjusted during render rather than in an effect, so the marks are right on
  // the same paint as the new order.
  const [history, setHistory] = useState<{
    readonly order: string;
    readonly ranks: ReadonlyMap<string, number>;
    readonly previous?: ReadonlyMap<string, number>;
  }>(() => ({
    order,
    ranks: new Map(alternatives.map((alt) => [alt.id, alt.rank])),
  }));
  if (history.order !== order) {
    setHistory({
      order,
      ranks: new Map(alternatives.map((alt) => [alt.id, alt.rank])),
      previous: history.ranks,
    });
  }

  // The list sits under the controls, usually below the fold of the rail, and
  // a ranking that plays out of sight might as well not animate. Only on a
  // Rank click: `run` is 0 when the list is merely being shown again.
  const frameRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (run === 0) return;
    frameRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "nearest",
    });
  }, [run]);

  return (
    <div ref={frameRef} className="relative overflow-hidden">
      {/* Keyed by run: a fresh element is the only way to replay a CSS
          animation that has already finished. */}
      {run > 0 && <span key={run} aria-hidden className="rank-scan" />}
      <ul ref={listRef} className="flex flex-col">
        {alternatives.map((alt) => (
          <RankedRow
            key={alt.id}
            alt={alt}
            feedsName={feedsName(alt.feedsNodeId)}
            factors={factors}
            previousRank={
              history.previous && (history.previous.get(alt.id) ?? null)
            }
            active={alt.id === selectedNodeId}
            onSelect={() => onSelectNode(alt.id)}
          />
        ))}
      </ul>
    </div>
  );
}
