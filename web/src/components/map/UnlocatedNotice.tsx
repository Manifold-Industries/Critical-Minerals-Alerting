import type { GraphNode } from "@/lib/api/types";

interface UnlocatedNoticeProps {
  unlocated: GraphNode[];
  total: number;
}

/** The app never guesses a location: unlocated assets are named, not pinned. */
export function UnlocatedNotice({ unlocated, total }: UnlocatedNoticeProps) {
  if (unlocated.length === 0) return null;
  return (
    <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <span className="font-medium">
        {unlocated.length} of {total} assets have no attested coordinates
      </span>{" "}
      and are not shown on the map: {unlocated.map((node) => node.name).join("; ")}.
    </div>
  );
}
