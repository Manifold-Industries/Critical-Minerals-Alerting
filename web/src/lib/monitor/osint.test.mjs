// Run with `npm test`. Node strips the types from osint.ts itself, so this
// needs no test framework.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PRIORITY_TONE_VAR,
  priorityTone,
  publishedLabel,
  screamingLabel,
  summarySegments,
} from "./osint.ts";

function development(id, { source = "ABC News", priority = "HIGH" } = {}) {
  return {
    id,
    title: id,
    source: { name: source, url: null },
    published_at: "2026-07-08",
    category: "OWNERSHIP_GOVERNANCE",
    priority,
    relevance_score: 0.9,
    summary: null,
    what_changed: null,
    why_it_matters: null,
    tags: [],
  };
}

function payload(developments, extra = {}) {
  return {
    node_id: "proj-browns-range",
    generated_at: "2026-09-22",
    sources_analyzed: null,
    ranking_note: null,
    developments,
    ...extra,
  };
}

// ── Priority ────────────────────────────────────────────────────────────────

test("the four known labels each get their own tone", () => {
  assert.equal(priorityTone("VERY_HIGH"), "top");
  assert.equal(priorityTone("HIGH"), "high");
  assert.equal(priorityTone("MEDIUM"), "medium");
  assert.equal(priorityTone("LOW"), "low");
});

test("a label this build has never seen is unranked, never a default", () => {
  assert.equal(priorityTone("CRITICAL"), "unranked");
  assert.equal(priorityTone(""), "unranked");
  assert.equal(priorityTone(null), "unranked");
  assert.equal(priorityTone(undefined), "unranked");
});

test("an unknown label is not coloured like a top-priority one", () => {
  assert.notEqual(
    PRIORITY_TONE_VAR[priorityTone("CRITICAL")],
    PRIORITY_TONE_VAR.top,
  );
});

test("every tone resolves to a colour token", () => {
  for (const tone of ["top", "high", "medium", "low", "unranked"]) {
    assert.match(PRIORITY_TONE_VAR[tone], /^--color-/);
  }
});

// ── Labels ──────────────────────────────────────────────────────────────────

test("a category renders as the producer's own string, spaced", () => {
  assert.equal(screamingLabel("OFFTAKE_FINANCING"), "OFFTAKE FINANCING");
  assert.equal(screamingLabel("VERY_HIGH"), "VERY HIGH");
});

test("a category of any arity survives, which a ' / ' join would not", () => {
  assert.equal(screamingLabel("PROJECT_STAGE_CHANGE"), "PROJECT STAGE CHANGE");
  assert.equal(screamingLabel("GEOPOLITICAL"), "GEOPOLITICAL");
});

// ── Dates ───────────────────────────────────────────────────────────────────

test("a publication date reads in the console's Zulu chrome", () => {
  assert.equal(publishedLabel("2026-07-08"), "08 JUL 2026");
  assert.equal(publishedLabel("2026-01-31"), "31 JAN 2026");
  assert.equal(publishedLabel("2026-12-01"), "01 DEC 2026");
});

test("the day is read off the string, so no timezone can shift it", () => {
  // `new Date("2026-07-08")` is UTC midnight: west of Greenwich its local day
  // is the 7th. The label must not move with the reader.
  assert.equal(publishedLabel("2026-07-08T00:00:00Z"), "08 JUL 2026");
});

test("an unparseable date is no date, never an invalid one", () => {
  assert.equal(publishedLabel(null), null);
  assert.equal(publishedLabel(undefined), null);
  assert.equal(publishedLabel(""), null);
  assert.equal(publishedLabel("last Tuesday"), null);
  assert.equal(publishedLabel("2026-13-01"), null);
});

// ── Summary ─────────────────────────────────────────────────────────────────

test("the summary counts what came back and where it came from", () => {
  const segments = summarySegments(
    payload([
      development("a", { source: "ABC News" }),
      development("b", { source: "ABC News" }),
      development("c", { source: "Mining Weekly" }),
    ]),
  );
  assert.deepEqual(segments, [
    "3 prioritized",
    "2 publications",
    "Corpus 22 SEP 2026",
  ]);
});

test("a screened count leads the line where the producer records one", () => {
  const segments = summarySegments(
    payload([development("a")], { sources_analyzed: 14 }),
  );
  assert.equal(segments[0], "14 screened");
});

test("no screened count is stated where the producer records none", () => {
  const segments = summarySegments(payload([development("a")]));
  assert.ok(!segments.some((s) => s.includes("screened")));
  // Null must not read as zero: "0 screened" would claim a measurement.
  assert.ok(!segments.some((s) => s.startsWith("0 ")));
});

test("one publication is singular", () => {
  const segments = summarySegments(payload([development("a")]));
  assert.ok(segments.includes("1 publication"));
});

test("an empty result has no counts to state", () => {
  assert.deepEqual(summarySegments(payload([])), []);
});

test("a corpus with no date simply omits it", () => {
  const segments = summarySegments(
    payload([development("a")], { generated_at: null }),
  );
  assert.ok(!segments.some((s) => s.startsWith("Corpus")));
});
