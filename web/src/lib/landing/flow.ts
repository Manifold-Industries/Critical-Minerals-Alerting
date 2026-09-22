// The entry flow, as a pure state machine. Kept out of the component so the
// path from "Enter System" to the console can be read — and tested — without a
// DOM: the modals are the only difference between these three states.

export type EntryState = "idle" | "consent" | "authenticating";

export type EntryEvent = "enter" | "agree" | "cancel";

/** Whether "Enter System" stops at the notice-and-consent modal. */
export const CONSENT_REQUIRED = true;

/** How long the authenticating modal is shown before the console is handed a
 *  session. Stands in for the CAC / PIV exchange, which this build does not do
 *  yet. */
export const AUTH_HANDOFF_MS = 2200;

/**
 * The next state for an event, or the current state when the event does not
 * apply. Never throws: an event that cannot happen from a given state (a stray
 * "agree" after cancel, say) leaves the flow where it was.
 */
export function nextEntryState(
  state: EntryState,
  event: EntryEvent,
  consentRequired: boolean = CONSENT_REQUIRED,
): EntryState {
  if (event === "cancel") return "idle";

  if (event === "enter") {
    return state === "idle"
      ? consentRequired
        ? "consent"
        : "authenticating"
      : state;
  }

  return state === "consent" ? "authenticating" : state;
}
