import assert from "node:assert/strict";
import test from "node:test";
import { groupFindings, sortFindings } from "../findings";
import { ScanResults } from "../types";

test("groups repeated rules while retaining each page and selector", () => {
  const results: ScanResults = {
    total: 2,
    passes: 0,
    errors: 2,
    failures: [],
    results: {
      "https://example.com/": [{
        type: "error",
        code: "WCAG2AA.Principle1.Guideline1_1.1_1_1.H30",
        message: "Link text should be descriptive",
        context: "<a href='/about'>more</a>",
        selector: "a:nth-child(1)",
        runner: "htmlcs"
      }],
      "https://example.com/about": [{
        type: "error",
        code: "WCAG2AA.Principle1.Guideline1_1.1_1_1.H30",
        message: "Link text should be descriptive",
        context: "<a href='/contact'>more</a>",
        selector: "a:nth-child(2)",
        runner: "htmlcs"
      }]
    }
  };

  const [finding] = groupFindings(results);
  assert.equal(groupFindings(results).length, 1);
  assert.equal(finding.count, 2);
  assert.equal(finding.severity, "Serious");
  assert.deepEqual(finding.occurrences.map((entry) => entry.url), [
    "https://example.com/",
    "https://example.com/about"
  ]);
  assert.deepEqual(finding.occurrences.map((entry) => entry.selector), [
    "a:nth-child(1)",
    "a:nth-child(2)"
  ]);
});

test("keeps otherwise matching axe findings separate when impact levels differ", () => {
  const results: ScanResults = {
    total: 1,
    passes: 0,
    errors: 2,
    failures: [],
    results: {
      "https://example.com/": [
        { type: "error", impact: "critical", code: "rule", message: "Same issue", context: "", selector: "", runner: "axe" },
        { type: "error", impact: "serious", code: "rule", message: "Same issue", context: "", selector: "", runner: "axe" }
      ]
    }
  };

  assert.deepEqual(groupFindings(results).map((finding) => finding.severity), ["Critical", "Serious"]);
});

test("sorts findings by descending severity and then alphabetically by title", () => {
  const findings = [
    { id: "minor-z", severity: "Minor" as const, code: "Zulu", message: "", type: "notice", count: 1, occurrences: [] },
    { id: "serious-z", severity: "Serious" as const, code: "Zulu", message: "", type: "error", count: 1, occurrences: [] },
    { id: "critical-z", severity: "Critical" as const, code: "Zulu", message: "", type: "error", count: 1, occurrences: [] },
    { id: "moderate-z", severity: "Moderate" as const, code: "Zulu", message: "", type: "warning", count: 1, occurrences: [] },
    { id: "critical-b", severity: "Critical" as const, code: "bravo", message: "", type: "error", count: 1, occurrences: [] },
    { id: "critical-a", severity: "Critical" as const, code: "Alpha", message: "", type: "error", count: 1, occurrences: [] }
  ];

  assert.deepEqual(sortFindings(findings).map((finding) => finding.id), [
    "critical-a",
    "critical-b",
    "critical-z",
    "serious-z",
    "moderate-z",
    "minor-z"
  ]);
  assert.deepEqual(findings.map((finding) => finding.id), [
    "minor-z",
    "serious-z",
    "critical-z",
    "moderate-z",
    "critical-b",
    "critical-a"
  ]);
});

test("does not merge findings with different rules or messages", () => {
  const results: ScanResults = {
    total: 1,
    passes: 0,
    errors: 2,
    failures: [],
    results: {
      "https://example.com/": [
        { type: "error", code: "rule-one", message: "First issue", context: "", selector: "", runner: "axe" },
        { type: "error", code: "rule-two", message: "First issue", context: "", selector: "", runner: "axe" },
        { type: "error", code: "rule-one", message: "Different issue", context: "", selector: "", runner: "axe" }
      ]
    }
  };

  assert.equal(groupFindings(results).length, 3);
});
