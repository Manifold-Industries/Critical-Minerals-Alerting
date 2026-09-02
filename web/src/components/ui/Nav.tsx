"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Flow" },
  { href: "/map", label: "Map" },
] as const;

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex shrink-0 items-center gap-1 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-700 dark:bg-zinc-950">
      <span className="mr-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Critical Minerals Alerting
      </span>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            pathname === link.href
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
