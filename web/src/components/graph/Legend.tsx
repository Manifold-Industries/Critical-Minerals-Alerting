"use client";

import {
  CONFIDENCE_STROKE,
  KIND_STYLE,
  STATUS_LEGEND,
  TYPE_LEGEND,
  UNRESOLVED_STYLE,
} from "@/lib/graph/styles";

function LineSample({ color, dash, width }: { color: string; dash?: string; width: number }) {
  return (
    <svg width="32" height="8" aria-hidden>
      <line x1="0" y1="4" x2="32" y2="4" stroke={color} strokeWidth={width} strokeDasharray={dash} />
    </svg>
  );
}

const NEUTRAL_LINE = TYPE_LEGEND[0].color;

/** Rendered from the same token tables the graph consumes — cannot disagree. */
export function Legend() {
  return (
    <div className="max-h-[70vh] w-48 overflow-y-auto rounded-md border border-zinc-200 bg-white/90 p-2 text-[10px] leading-4 text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-300">
      <p className="font-semibold">Nodes</p>
      <ul className="mb-2">
        {Object.values(KIND_STYLE).map((style) => (
          <li key={style.label} className="flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm border ${style.container}`} />
            {style.label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className={`inline-block h-2.5 w-2.5 rounded-sm border-2 ${UNRESOLVED_STYLE.container}`} />
          {UNRESOLVED_STYLE.label}
        </li>
      </ul>
      <p className="font-semibold">Edge status</p>
      <ul className="mb-2">
        {STATUS_LEGEND.map((entry) => (
          <li key={entry.label} className={`flex items-center gap-1.5 ${entry.muted ? "opacity-50" : ""}`}>
            <LineSample color={NEUTRAL_LINE} dash={entry.dash} width={2} />
            {entry.label}
          </li>
        ))}
      </ul>
      <p className="font-semibold">Edge type</p>
      <ul className="mb-2">
        {TYPE_LEGEND.map((entry) => (
          <li key={entry.label} className="flex items-center gap-1.5">
            <LineSample color={entry.color} width={2} />
            {entry.label}
          </li>
        ))}
      </ul>
      <p className="font-semibold">Assertion confidence</p>
      <ul>
        {(Object.keys(CONFIDENCE_STROKE) as (keyof typeof CONFIDENCE_STROKE)[]).map((confidence) => (
          <li key={confidence} className="flex items-center gap-1.5" style={{ opacity: CONFIDENCE_STROKE[confidence].opacity }}>
            <LineSample color={NEUTRAL_LINE} width={CONFIDENCE_STROKE[confidence].strokeWidth} />
            {confidence.toLowerCase()}
          </li>
        ))}
      </ul>
    </div>
  );
}
