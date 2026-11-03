import assert from "node:assert/strict";
import test from "node:test";
import { groupFindings } from "../findings";
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
  assert.deepEqual(finding.occurrences.map((entry) => entry.url), [
    "https://example.com/",
    "https://example.com/about"
  ]);
  assert.deepEqual(finding.occurrences.map((entry) => entry.selector), [
    "a:nth-child(1)",
    "a:nth-child(2)"
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
