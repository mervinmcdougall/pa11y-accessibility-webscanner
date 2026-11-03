import assert from "node:assert/strict";
import test from "node:test";
import { parseResults } from "../scanner";

test("parses Pa11y results and retains axe impact metadata", () => {
  const results = parseResults(JSON.stringify({
    total: 1,
    passes: 0,
    errors: 1,
    results: {
      "https://example.com/": [{
        type: "error",
        code: "image-alt",
        message: "Images must have alternate text",
        context: "<img src=\"image.png\">",
        selector: "img",
        runner: "axe",
        runnerExtras: { impact: "critical" }
      }]
    },
    failures: []
  }));

  assert.equal(results.total, 1);
  assert.equal(results.results["https://example.com/"][0].impact, "critical");
  assert.deepEqual(results.failures, []);
});

test("parses page-level browser/navigation failures without rejecting the report", () => {
  const results = parseResults(JSON.stringify({
    total: 1,
    passes: 0,
    errors: 0,
    results: {
      "https://example.com/": [{}]
    },
    failures: [{
      url: "https://example.com/",
      message: "Navigation failed because the server returned an error."
    }]
  }));

  assert.equal(results.total, 1);
  assert.deepEqual(results.results["https://example.com/"], []);
  assert.deepEqual(results.failures, [{
    url: "https://example.com/",
    message: "Navigation failed because the server returned an error."
  }]);
});

test("reports invalid report-file JSON with its parser error", () => {
  assert.throws(
    () => parseResults("Chromium startup output"),
    /invalid report file \(Unexpected token/
  );
});
