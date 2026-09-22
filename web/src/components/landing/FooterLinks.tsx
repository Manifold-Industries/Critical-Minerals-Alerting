import { FOOTER_LINKS } from "@/lib/landing/content";

// Statutory links. External addresses are marked so a reader knows the link
// leaves the system.
export default function FooterLinks() {
  return (
    <nav aria-label="Site information" className="pb-6">
      <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs text-text-tertiary">
        {FOOTER_LINKS.map(({ label, href }) => {
          const isExternal = href.startsWith("http");
          return (
            <li key={label}>
              <a
                href={href}
                {...(isExternal
                  ? { target: "_blank", rel: "noreferrer noopener" }
                  : {})}
                className="transition-colors duration-150 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
