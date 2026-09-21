// Run with `node --test src/lib/monitor/`.
import assert from "node:assert/strict";
import { test } from "node:test";

import { briefHref, parseBriefParams } from "./briefLink.ts";

const ALERTS = [{ id: "SA-047", mineId: "proj-mount-weld" }, { id: "SA-036" }];

function paramsOf(href) {
  return Object.fromEntries(new URL(href, "http://x").searchParams);
}

test("a link round-trips the alert, year and weights", () => {
  const href = briefHref("SA-047", {
    year: 2030,
    weights: { alignment: 2, commitment: 5 },
  });
  const request = parseBriefParams(paramsOf(href), ALERTS);
  assert.equal(request.alert.id, "SA-047");
  assert.equal(request.year, 2030);
  assert.deepEqual(request.weights, { alignment: 2, commitment: 5 });
  assert.equal(request.problem, undefined);
});

test("a bare link asks for no particular brief, and is not an error", () => {
  assert.deepEqual(parseBriefParams({}, ALERTS), { weights: null });
});

test("an unranked link carries no weights", () => {
  const href = briefHref("SA-036");
  assert.equal(href, "/brief?alert=SA-036");
  assert.equal(parseBriefParams(paramsOf(href), ALERTS).weights, null);
});

test("an unknown alert is named, not guessed at", () => {
  const request = parseBriefParams({ alert: "SA-999" }, ALERTS);
  assert.equal(request.alert, undefined);
  assert.match(request.problem, /SA-999/);
});

test("a bad year or bad weights fall back, and say so", () => {
  const request = parseBriefParams(
    { alert: "SA-047", year: "1492", w: "alignment:99" },
    ALERTS,
  );
  assert.equal(request.alert.id, "SA-047");
  assert.equal(request.year, undefined);
  assert.equal(request.weights, null);
  assert.match(request.problem, /year/);
  assert.match(request.problem, /weights/);
});

test("a repeated parameter takes its first value", () => {
  const request = parseBriefParams({ alert: ["SA-036", "SA-047"] }, ALERTS);
  assert.equal(request.alert.id, "SA-036");
});
