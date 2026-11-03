import assert from "node:assert/strict";
import test from "node:test";
import { severityForType, summarizeSeverities } from "../severity";
import { Finding } from "../types";

function finding(type: string, count: number): Finding {
  return {
    id: `${type}-${count}`,
    type,
    severity: severityForType(type),
    code: "rule",
    message: "Finding",
    count,
    occurrences: []
  };
}

test("maps axe impact levels to the four report severities", () => {
  assert.equal(severityForType("error", "critical"), "Critical");
  assert.equal(severityForType("error", "serious"), "Serious");
  assert.equal(severityForType("warning", "moderate"), "Moderate");
  assert.equal(severityForType("notice", "minor"), "Minor");
});

test("maps Pa11y levels conservatively when axe impact is unavailable", () => {
  assert.equal(severityForType("error"), "Serious");
  assert.equal(severityForType(" Warning "), "Moderate");
  assert.equal(severityForType("NOTICE"), "Minor");
  assert.equal(severityForType("unknown"), "Minor");
});

test("counts occurrences per severity rather than deduplicated finding rows", () => {
  assert.deepEqual(summarizeSeverities([
    finding("error", 3),
    finding("warning", 2),
    finding("notice", 1)
  ]), [
    { severity: "Critical", count: 0 },
    { severity: "Serious", count: 3 },
    { severity: "Moderate", count: 2 },
    { severity: "Minor", count: 1 }
  ]);
});

test("counts all four severity levels in one summary", () => {
  assert.deepEqual(summarizeSeverities([
    { ...finding("error", 2), severity: "Critical" },
    { ...finding("error", 3), severity: "Serious" },
    { ...finding("warning", 4), severity: "Moderate" },
    { ...finding("notice", 5), severity: "Minor" }
  ]), [
    { severity: "Critical", count: 2 },
    { severity: "Serious", count: 3 },
    { severity: "Moderate", count: 4 },
    { severity: "Minor", count: 5 }
  ]);
});
