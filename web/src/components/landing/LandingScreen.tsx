"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { DEFAULT_MODULE_HREF } from "@/lib/modules";
import {
  AUTH_HANDOFF_MS,
  nextEntryState,
  type EntryEvent,
  type EntryState,
} from "@/lib/landing/flow";
import AuthenticatingModal from "./AuthenticatingModal";
import ConsentModal from "./ConsentModal";
import EntryBlock from "./EntryBlock";

// Owns the entry flow: the masthead is always on screen, and the state decides
// which modal, if any, sits over it. Cancelling from either modal returns here
// with nothing else changed.
export default function LandingScreen() {
  const router = useRouter();
  const [state, setState] = useState<EntryState>("idle");

  const send = useCallback((event: EntryEvent) => {
    setState((current) => nextEntryState(current, event));
  }, []);

  const cancel = useCallback(() => send("cancel"), [send]);

  // The credential exchange is not wired up yet, so the modal stands in for it
  // and then hands off to the console. Cancelling clears the timer.
  useEffect(() => {
    if (state !== "authenticating") return;

    const timer = setTimeout(() => {
      router.push(DEFAULT_MODULE_HREF);
    }, AUTH_HANDOFF_MS);

    return () => clearTimeout(timer);
  }, [state, router]);

  return (
    <>
      <section className="flex flex-1 items-center justify-center py-[clamp(16px,4vh,56px)]">
        <EntryBlock onEnter={() => send("enter")} />
      </section>

      {state === "consent" ? (
        <ConsentModal onAgree={() => send("agree")} onCancel={cancel} />
      ) : null}

      {state === "authenticating" ? (
        <AuthenticatingModal onCancel={cancel} />
      ) : null}
    </>
  );
}
