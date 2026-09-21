// Run with `node --test src/lib/monitor/ranking.test.mjs`. Node strips the
// types from ranking.ts itself, so this needs no test framework.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_FACTOR_WEIGHTS,
  factorAvailability,
  formatWeights,
  parseWeights,
  rankCandidates,
} from "./ranking.ts";

function factor(name, normalized, known = true) {
  return {
    factor: name,
    label: name.toUpperCase(),
    normalized,
    contribution: 0,
    maxContribution: 0,
    known,
    detail: null,
  };
}

function candidate(id, factors, feedsNodeId = "plant-a") {
  return {
    id,
    rank: 0,
    name: id,
    country: "",
    lon: 0,
    lat: 0,
    feedsNodeId,
    scoreFactors: factors,
  };
}

const POOL = [
  candidate("domestic", [factor("alignment", 1), factor("coverage", 0.2)]),
  candidate("ally", [factor("alignment", 0.75), factor("coverage", 1)]),
  candidate("partner", [factor("alignment", 0.5), factor("coverage", 1, false)]),
];

test("default weights rank on alignment alone", () => {
  const ranked = rankCandidates(POOL, DEFAULT_FACTOR_WEIGHTS, 10);
  assert.deepEqual(
    ranked.map((c) => [c.id, c.rank, c.score]),
    [
      ["domestic", 1, 100],
      ["ally", 2, 75],
      ["partner", 3, 50],
    ],
  );
});

test("weights are relative, and contributions sum to the score", () => {
  const ranked = rankCandidates(POOL, { alignment: 1, coverage: 3 }, 10);
  assert.deepEqual(
    ranked.map((c) => c.id),
    ["ally", "partner", "domestic"],
  );
  const top = ranked[0];
  assert.equal(top.score, 93.75);
  assert.equal(
    top.scoreFactors.reduce((sum, f) => sum + f.contribution, 0),
    top.score,
  );
  assert.deepEqual(
    top.scoreFactors.map((f) => f.maxContribution),
    [25, 75],
  );
});

test("equal scores keep the engine's order", () => {
  const tied = [
    candidate("first", [factor("alignment", 0.5)]),
    candidate("second", [factor("alignment", 0.5)]),
  ];
  const ranked = rankCandidates(tied, DEFAULT_FACTOR_WEIGHTS, 10);
  assert.deepEqual(
    ranked.map((c) => c.id),
    ["first", "second"],
  );
});

test("a source feeding two plants appears once, at its better pairing", () => {
  const pool = [
    candidate("mine", [factor("alignment", 1), factor("coverage", 0.1)], "plant-a"),
    candidate("mine", [factor("alignment", 1), factor("coverage", 0.9)], "plant-b"),
  ];
  const ranked = rankCandidates(pool, { coverage: 1 }, 10);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].feedsNodeId, "plant-b");
});

test("the limit applies after ranking, not before", () => {
  const ranked = rankCandidates(POOL, { coverage: 1 }, 1);
  assert.deepEqual(
    ranked.map((c) => c.id),
    ["ally"],
  );
});

test("no weight in play ranks nothing", () => {
  assert.deepEqual(rankCandidates(POOL, {}, 10), []);
  assert.deepEqual(rankCandidates(POOL, { alignment: 0 }, 10), []);
});

test("a factor the reader cannot weight carries none", () => {
  const pool = [
    candidate("sure", [factor("alignment", 0.5), factor("confidence", 1)]),
    candidate("aligned", [factor("alignment", 1), factor("confidence", 0)]),
  ];
  const ranked = rankCandidates(pool, { alignment: 1, confidence: 5 }, 10);
  assert.deepEqual(
    ranked.map((c) => [c.id, c.score]),
    [
      ["aligned", 100],
      ["sure", 50],
    ],
  );
});

test("ranking leaves the pool untouched", () => {
  const before = JSON.stringify(POOL);
  rankCandidates(POOL, { coverage: 1 }, 10);
  assert.equal(JSON.stringify(POOL), before);
});

test("a factor with any fallback value is unavailable", () => {
  const byFactor = new Map(
    factorAvailability(POOL).map((a) => [a.factor, a]),
  );
  assert.deepEqual(byFactor.get("coverage"), {
    factor: "coverage",
    total: 3,
    missing: 1,
    available: false,
  });
  assert.equal(byFactor.get("alignment").available, true);
  // Never measured at all is the limiting case of incomplete.
  assert.equal(byFactor.get("time_to_flow").available, false);
  assert.equal(byFactor.get("time_to_flow").missing, 3);
  assert.equal(byFactor.has("evidence"), false);
  assert.equal(byFactor.has("confidence"), false);
});

test("availability counts sources, not pairings", () => {
  const pool = [
    candidate("mine", [factor("coverage", 1)], "plant-a"),
    candidate("mine", [factor("coverage", 0.5, false)], "plant-b"),
    candidate("other", [factor("coverage", 1)], "plant-a"),
  ];
  const coverage = factorAvailability(pool).find((a) => a.factor === "coverage");
  assert.equal(coverage.total, 2);
  assert.equal(coverage.missing, 1);
});

test("alignment stays available with gaps, and reports them", () => {
  const pool = [
    candidate("assessed", [factor("alignment", 1)]),
    candidate("unassessed", [factor("alignment", 0.25, false)]),
  ];
  const alignment = factorAvailability(pool).find(
    (a) => a.factor === "alignment",
  );
  assert.deepEqual(alignment, {
    factor: "alignment",
    total: 2,
    missing: 1,
    available: true,
  });
});

test("weights survive a round trip through a URL", () => {
  const weights = { alignment: 2, commitment: 5 };
  assert.equal(formatWeights(weights), "alignment:2,commitment:5");
  assert.deepEqual(parseWeights(formatWeights(weights)), weights);
});

test("formatting drops zeroes and factors that cannot be weighted", () => {
  assert.equal(
    formatWeights({ alignment: 1, coverage: 0, confidence: 4 }),
    "alignment:1",
  );
});

test("a URL cannot smuggle in a weight the panel could not set", () => {
  for (const raw of [
    undefined,
    "",
    "alignment",
    "alignment:six",
    "alignment:9",
    "alignment:-1",
    "alignment:1.5",
    "confidence:3",
    "alignment:0",
    "alignment:1,alignment:2",
  ]) {
    assert.equal(parseWeights(raw), null, String(raw));
  }
});
