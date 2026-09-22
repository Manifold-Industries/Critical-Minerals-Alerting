// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";

import { nextEntryState } from "./flow.ts";

test("entering opens the consent notice when consent is required", () => {
  assert.equal(nextEntryState("idle", "enter", true), "consent");
});

test("entering goes straight to authenticating when consent is turned off", () => {
  assert.equal(nextEntryState("idle", "enter", false), "authenticating");
});

test("agreeing to the notice starts authentication", () => {
  assert.equal(nextEntryState("consent", "agree", true), "authenticating");
});

test("cancelling from either modal returns to the landing screen", () => {
  assert.equal(nextEntryState("consent", "cancel", true), "idle");
  assert.equal(nextEntryState("authenticating", "cancel", true), "idle");
});

test("an event that does not apply leaves the flow where it was", () => {
  assert.equal(nextEntryState("idle", "agree", true), "idle");
  assert.equal(nextEntryState("authenticating", "agree", true), "authenticating");
  assert.equal(nextEntryState("consent", "enter", true), "consent");
});
