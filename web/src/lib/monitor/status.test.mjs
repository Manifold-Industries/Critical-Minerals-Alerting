// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";

import { statusTone, STATUS_TONE_VAR } from "./status.ts";

test("an operating site is producing", () => {
  assert.equal(statusTone("OPERATING"), "producing");
});

test("a site that is not yet producing is pending, whatever its stage", () => {
  assert.equal(statusTone("PLANNED"), "pending");
  assert.equal(statusTone("UNDER_CONSTRUCTION"), "pending");
  assert.equal(statusTone("COMMISSIONING"), "pending");
});

test("a suspended or closed site is offline", () => {
  assert.equal(statusTone("SUSPENDED"), "offline");
  assert.equal(statusTone("CLOSED"), "offline");
});

test("a missing or unrecognised status is unknown, never a default", () => {
  assert.equal(statusTone(undefined), "unknown");
  assert.equal(statusTone(null), "unknown");
  assert.equal(statusTone(""), "unknown");
  assert.equal(statusTone("MOTHBALLED"), "unknown");
});

test("every tone resolves to a colour token", () => {
  for (const tone of ["producing", "pending", "offline", "unknown"]) {
    assert.match(STATUS_TONE_VAR[tone], /^--/);
  }
});
