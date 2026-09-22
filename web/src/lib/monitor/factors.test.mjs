// Run with `npm test`. Node strips the types from factors.ts itself, so this
// needs no test framework.
//
// The table is data, so these do not restate it. They pin the two things that
// break quietly when someone adds a factor: a malformed entry, and an id that
// does not match the engine's `ScoreFactor`.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BASE_FACTOR,
  FACTORS,
  RANK_FACTORS,
  factorDescription,
  factorName,
  factorShade,
} from "./factors.ts";

test("every factor is fully described", () => {
  for (const f of FACTORS) {
    assert.ok(f.id, "factor has no id");
    assert.ok(f.name, `${f.id} has no name`);
    assert.ok(f.description, `${f.id} has no description`);
    assert.ok(f.shade, `${f.id} has no shade`);
  }
});

test("ids are unique and drive the panel order", () => {
  assert.equal(new Set(RANK_FACTORS).size, RANK_FACTORS.length);
  assert.deepEqual(
    RANK_FACTORS,
    FACTORS.map((f) => f.id),
  );
});

test("the base factor is one the panel actually lists", () => {
  assert.ok(RANK_FACTORS.includes(BASE_FACTOR));
});

test("factor ids match the engine's ScoreFactor values", () => {
  // Three of the engine's five. Evidence and confidence grade how well the
  // graph knows about a link, not how good the source is. Operating status is
  // not a factor at all: it gates the pool before ranking.
  assert.deepEqual([...RANK_FACTORS].sort(), ["alignment", "commitment", "coverage"]);
});

test("a factor the client has not been taught about still prints", () => {
  assert.equal(factorName("something_new"), "something_new");
  assert.equal(factorDescription("something_new"), undefined);
  assert.equal(factorShade("something_new"), "var(--accent)");
});
