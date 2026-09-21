// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";

import { bottomLine, briefLimits, joinNames } from "./brief.ts";

const ALERT = { id: "SA-047", severity: "critical", title: "Washout" };

function alt(rank, name, score, factors = []) {
  return { id: name, rank, name, country: "Australia", score, scoreFactors: factors };
}

const GRAPH = {
  asOfYear: 2027,
  asset: { id: "m", name: "Mt Weld", place: "Australia" },
  capacity: {
    as_of_year: 2027,
    total_tpa: 1000,
    affected_tpa: 150,
    affected_share: 0.15,
    refiners_total: 5,
    refiners_disclosing: 4,
    undisclosed_facility_ids: [],
  },
  downstream: [
    { id: "a", name: "Kalgoorlie", soleSource: true },
    { id: "b", name: "Lynas Malaysia", soleSource: false },
  ],
  alternatives: [alt(1, "Fingerboards", 96), alt(2, "Wimmera", 96), alt(3, "Caldeira", 92)],
  candidates: [],
  warnings: [],
};

const EXPOSURE = {
  elements: ["Dy", "Tb"],
  platforms: [{ name: "F-35" }, { name: "Tomahawk" }, { name: "Virginia-class sonar" }],
  warnings: [],
};

test("names are joined the way a sentence needs", () => {
  assert.equal(joinNames([]), "");
  assert.equal(joinNames(["Dy"]), "Dy");
  assert.equal(joinNames(["Dy", "Tb"]), "Dy and Tb");
  assert.equal(joinNames(["a", "b", "c"]), "a, b and c");
});

test("the bottom line states each thing the graph holds", () => {
  const lines = bottomLine({
    alert: ALERT,
    graph: GRAPH,
    exposure: EXPOSURE,
    weights: { alignment: 1, commitment: 5 },
  });
  assert.deepEqual(lines, [
    "A critical-severity disruption is reported at Mt Weld, Australia.",
    "15% of known Dy/Tb separation capacity lost feed: 150 of 1,000 tonnes a year, on 2027 figures.",
    "2 downstream plants lose feed, and 1 of them has no other supplier.",
    "3 weapons systems depend on Dy and Tb, including F-35 and Tomahawk.",
    "Fingerboards and Wimmera rank joint first as replacement sources, weighted on country alignment ×1 and uncommitted supply ×5.",
  ]);
});

test("plants that are all sole-sourced are not counted twice", () => {
  const lines = bottomLine({
    alert: ALERT,
    graph: { ...GRAPH, downstream: GRAPH.downstream.map((p) => ({ ...p, soleSource: true })) },
    exposure: undefined,
    weights: null,
  });
  assert.equal(
    lines[2],
    "2 downstream plants lose feed, and none of them has another supplier.",
  );
});

test("a single leader, under the default order, reads differently", () => {
  const lines = bottomLine({
    alert: ALERT,
    graph: { ...GRAPH, alternatives: [alt(1, "Mountain Pass", 100), alt(2, "Donald", 75)] },
    exposure: undefined,
    weights: null,
  });
  assert.equal(
    lines.at(-1),
    "Mountain Pass (Australia) ranks first as a replacement source, on country alignment alone, the default.",
  );
  // No exposure: nothing is said about weapons systems rather than "0".
  assert.equal(lines.some((l) => l.includes("weapons")), false);
});

test("an unsizable share is said to be unknown, never zero", () => {
  const lines = bottomLine({
    alert: ALERT,
    graph: {
      ...GRAPH,
      capacity: { ...GRAPH.capacity, affected_tpa: null, affected_share: null },
    },
    exposure: undefined,
    weights: null,
  });
  assert.match(lines[1], /cannot be sized/);
  assert.equal(lines[1].includes("0%"), false);
});

test("with no graph there is only the report", () => {
  assert.deepEqual(
    bottomLine({ alert: ALERT, graph: undefined, exposure: undefined, weights: null }),
    ["A critical-severity disruption is reported."],
  );
});

test("limits carry the engine's warnings and the data gaps", () => {
  const known = (factor, isKnown) => ({ factor, known: isKnown, normalized: 1, label: "" });
  const graph = {
    ...GRAPH,
    warnings: ["scores rest on alignment alone"],
    candidates: [
      { ...alt(0, "A", 0, [known("alignment", true), known("coverage", false)]) },
      { ...alt(0, "B", 0, [known("alignment", false), known("coverage", true)]) },
    ],
  };
  const limits = briefLimits({
    graph,
    exposure: { ...EXPOSURE, warnings: ["end-use layer incomplete"] },
    weights: { alignment: 1 },
  });
  assert.ok(limits.includes("scores rest on alignment alone"));
  assert.ok(limits.includes("end-use layer incomplete"));
  assert.ok(
    limits.some((l) => /Capacity to cover the gap/.test(l) && /1 of 2/.test(l)),
    "names the factor that could not be weighted",
  );
  assert.ok(
    limits.some((l) => /1 of 2 candidate/.test(l) && /alignment/i.test(l)),
    "names the unassessed countries behind a factor that was used",
  );
  // Every brief carries the standing limits, whatever the data.
  assert.ok(limits.some((l) => /classes/.test(l)));
});
