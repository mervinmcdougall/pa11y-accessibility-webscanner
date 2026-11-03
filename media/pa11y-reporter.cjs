"use strict";

const fs = require("node:fs");

// Creates the Pa11y reporter that streams progress and writes the final report to a file.
module.exports = function createReporter() {
  const failures = [];

  return {
    // Emits a tagged progress event for the extension host.
    begin(url) {
      process.stderr.write(`PA11Y_PROGRESS:${JSON.stringify({ url })}\n`);
    },
    // Records page-level errors so successful pages can still be reported.
    error(error, url) {
      failures.push({
        url,
        message: error instanceof Error ? error.message : String(error)
      });
    },
    // Persists scan results separately from process output and diagnostics.
    afterAll(report) {
      // Keep machine-readable results separate from stdout/stderr diagnostics and progress.
      const reportPath = process.env.PA11Y_REPORT_PATH;
      if (!reportPath) {
        throw new Error("PA11Y_REPORT_PATH is required to save the scan report.");
      }
      fs.writeFileSync(reportPath, JSON.stringify({
        total: report.total,
        passes: report.passes,
        errors: report.errors,
        results: report.results,
        failures
      }), "utf8");
    }
  };
};
