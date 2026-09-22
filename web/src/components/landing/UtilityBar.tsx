import { GOVERNMENT_NOTICE, SYSTEM_LABELS } from "@/lib/landing/content";

// Ownership on the left, system identity on the right, hairline underneath.
// Both halves wrap on narrow screens rather than shrinking the type.
export default function UtilityBar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-surface-2 py-2.5 font-mono text-xs tracking-[0.04em] text-text-secondary">
      <p>{GOVERNMENT_NOTICE}</p>
      <ul className="flex flex-wrap items-center gap-x-6 gap-y-1 text-text-tertiary">
        {SYSTEM_LABELS.map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
    </div>
  );
}
