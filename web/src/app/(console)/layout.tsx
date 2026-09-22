import type { ReactNode } from "react";

import CommandHeader from "@/components/CommandHeader";
import NavRail from "@/components/NavRail";

// The console frame — identity strip and module rail — around every working
// screen. The landing page sits outside this group and so carries neither.
export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CommandHeader />
      <div className="flex min-h-0 flex-1">
        <NavRail />
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
    </>
  );
}
