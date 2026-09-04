import { Suspense } from "react";
import type { Metadata } from "next";
import BriefConsole from "@/components/brief/BriefConsole";

export const metadata: Metadata = {
  title: "Decision Brief",
};

// The console reads `?alert=` with useSearchParams, so it sits under a
// Suspense boundary: the shell prerenders and the URL-dependent body renders
// on the client, per the App Router's prerendering contract for that hook.
export default function BriefPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={null}>
        <BriefConsole />
      </Suspense>
    </div>
  );
}
