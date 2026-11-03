"use strict";

const fs = require("node:fs");

module.exports = function createReporter() {
  const failures = [];

  return {
    begin(url) {
      process.stderr.write(`PA11Y_PROGRESS:${JSON.stringify({ url })}\n`);
    },
    error(error, url) {
      failures.push({
        url,
        message: error instanceof Error ? error.message : String(error)
      });
    },
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
