import type { CSSProperties } from "react";
import { statusLabel } from "@/lib/monitor/format";
import {
  STATUS_TONE_VAR,
  STATUS_UNKNOWN_LABEL,
  statusTone,
} from "@/lib/monitor/status";

interface OperatingStatusBadgeProps {
  /** The API's operating status. Missing means the graph does not record one. */
  readonly status: string | null | undefined;
  /** The asset card carries the badge a step larger than a list row. */
  readonly size?: "sm" | "lg";
}

/**
 * Whether a mine or plant is producing, as a tinted chip.
 *
 * A third mark beside the severity square and the confidence circle, and
 * shaped like neither: a labelled chip, so it cannot be mistaken for either.
 * The tint answers the one question the reader has (is it running?) before the
 * label spells out which status it is. Shared by the asset card, the at-risk
 * rows and the brief, so a status never looks different in two places.
 */
export default function OperatingStatusBadge({
  status,
  size = "sm",
}: OperatingStatusBadgeProps) {
  const tone = statusTone(status);
  const label = status ? statusLabel(status) : STATUS_UNKNOWN_LABEL;
  return (
    <span
      className={`tag tag-status ${size === "lg" ? "tag-status-lg" : ""}`}
      data-tone={tone}
      style={{ "--tone": `var(${STATUS_TONE_VAR[tone]})` } as CSSProperties}
      title={`Operating status: ${label}`}
    >
      <span aria-hidden className="tag-status-mark" />
      {label}
    </span>
  );
}
