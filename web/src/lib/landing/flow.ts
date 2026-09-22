// The entry flow.
//
// There is no credential exchange yet: "Enter System" shows the notice, and
// agreeing opens the console. The screen says as much rather than staging a
// CAC / PIV prompt the system cannot honour — when sign-in lands, the step goes
// between the notice and the handoff.

/** Whether "Enter System" stops at the notice-and-consent modal first. */
export const CONSENT_REQUIRED = true;
