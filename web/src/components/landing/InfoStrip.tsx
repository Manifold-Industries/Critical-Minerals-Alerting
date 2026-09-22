import { INFO_COLUMNS } from "@/lib/landing/content";

// Three columns that collapse to one when a column can no longer hold 240px.
export default function InfoStrip() {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-x-[clamp(24px,4vw,64px)] gap-y-8 border-t border-surface-2 py-7">
      {INFO_COLUMNS.map(({ label, body, link }) => (
        <section key={label} className="flex flex-col gap-1.5">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-accent">
            {label}
          </h2>
          <p className="text-sm leading-[1.55] text-text-secondary">{body}</p>
          {link ? (
            <a
              href={link.href}
              className="mt-0.5 self-start border-b border-surface-2 text-sm text-foreground transition-colors duration-150 hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {link.label}
            </a>
          ) : null}
        </section>
      ))}
    </div>
  );
}
