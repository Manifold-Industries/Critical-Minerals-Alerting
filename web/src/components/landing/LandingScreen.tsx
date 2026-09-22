"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { CONSENT_REQUIRED } from "@/lib/landing/flow";
import { DEFAULT_MODULE_HREF } from "@/lib/modules";
import ConsentModal from "./ConsentModal";
import EntryBlock from "./EntryBlock";

// Owns the entry flow: the masthead is always on screen, and "Enter System"
// either shows the notice first or goes straight through. Cancelling the notice
// returns here with nothing else changed.
export default function LandingScreen() {
  const router = useRouter();
  const [isConsentOpen, setIsConsentOpen] = useState(false);

  const enterConsole = useCallback(() => {
    setIsConsentOpen(false);
    router.push(DEFAULT_MODULE_HREF);
  }, [router]);

  const handleEnter = useCallback(() => {
    if (CONSENT_REQUIRED) {
      setIsConsentOpen(true);
      return;
    }
    enterConsole();
  }, [enterConsole]);

  const closeConsent = useCallback(() => setIsConsentOpen(false), []);

  return (
    <>
      <section className="flex flex-1 items-center justify-center py-[clamp(16px,4vh,56px)]">
        <EntryBlock onEnter={handleEnter} />
      </section>

      {isConsentOpen ? (
        <ConsentModal onAgree={enterConsole} onCancel={closeConsent} />
      ) : null}
    </>
  );
}
