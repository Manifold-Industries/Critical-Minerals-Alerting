import type { CSSProperties } from "react";
import type { Severity } from "@/lib/monitor/alerts";
import { SEVERITY_COLOR } from "@/lib/monitor/colors";

/**
 * Elements the console spells out on hover. Deliberately partial: it covers
 * the Dy/Tb scope and what the seed alerts name, and an unlisted symbol gets
 * no tooltip rather than a guessed one.
 */
export const ELEMENT_NAME: Record<string, string> = {
  Dy: "Dysprosium",
  Tb: "Terbium",
  Nd: "Neodymium",
  Pr: "Praseodymium",
  Ga: "Gallium",
  Co: "Cobalt",
  Li: "Lithium",
  Ni: "Nickel",
};

interface ElementBadgesProps {
  readonly symbols: readonly string[];
  /** Tints the boxes, so a queue row and the panel title agree on the colour. */
  readonly severity: Severity;
  /** The panel title carries the same boxes a touch larger than a queue row. */
  readonly size?: "sm" | "lg";
}

/**
 * The minerals an alert is about, as boxed symbols. Shared so the queue row and
 * the decision panel title cannot drift apart on what an element looks like.
 */
export default function ElementBadges({
  symbols,
  severity,
  size = "sm",
}: ElementBadgesProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      style={{ "--sev": SEVERITY_COLOR[severity] } as CSSProperties}
    >
      {symbols.map((symbol) => (
        <span
          key={symbol}
          title={ELEMENT_NAME[symbol]}
          className={`border border-[color-mix(in_srgb,var(--sev)_60%,var(--surface-2))] bg-[color-mix(in_srgb,var(--sev)_30%,transparent)] font-mono leading-none font-semibold text-foreground ${
            size === "lg"
              ? "px-2.5 py-2 text-[20px]"
              : "px-2 py-1.5 text-[17px]"
          }`}
        >
          {symbol}
        </span>
      ))}
    </div>
  );
}
