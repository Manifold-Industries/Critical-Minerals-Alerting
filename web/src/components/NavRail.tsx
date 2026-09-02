"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULES } from "@/lib/modules";

export default function NavRail() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Modules"
      className="flex w-16 shrink-0 flex-col items-center border-r border-surface-2 bg-surface-1 pt-3"
    >
      <Link
        href="/"
        aria-label="Home"
        className="flex h-9 w-9 items-center justify-center border border-accent bg-accent-tint font-mono text-[13px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        CM
      </Link>
      <span className="mt-1.5 font-mono text-[7px] uppercase tracking-[0.18em] text-text-tertiary">
        MINERALS
      </span>

      <div aria-hidden="true" className="grow" />
      <div className="flex flex-col items-center gap-2 py-2">
        {MODULES.map(({ name, href, icon: Icon, disabled }) => {
          const isActive = pathname.startsWith(href);
          if (disabled) {
            return (
              <span
                key={href}
                aria-label={name}
                aria-disabled="true"
                className="box-border flex h-10 w-10 cursor-not-allowed flex-col items-center justify-center text-text-tertiary opacity-50"
              >
                <Icon size={18} aria-hidden="true" />
                <span className="mt-0.5 font-mono text-[9px] uppercase leading-none tracking-wide text-text-tertiary">
                  {name}
                </span>
              </span>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              aria-label={name}
              aria-current={isActive ? "page" : undefined}
              className={`box-border flex h-10 w-10 flex-col items-center justify-center transition-colors duration-150 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                isActive
                  ? "border border-accent bg-accent-tint text-accent"
                  : "text-text-secondary hover:bg-ghost-hover"
              }`}
            >
              <Icon size={18} aria-hidden="true" />
              <span
                className={`mt-0.5 font-mono text-[9px] uppercase leading-none tracking-wide ${
                  isActive ? "text-accent" : "text-text-tertiary"
                }`}
              >
                {name}
              </span>
            </Link>
          );
        })}
      </div>
      <div aria-hidden="true" className="grow-[2]" />
    </nav>
  );
}
