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
      fs.writeSync(process.stdout.fd, JSON.stringify({
        total: report.total,
        passes: report.passes,
        errors: report.errors,
        results: report.results,
        failures
      }));
    }
  };
};
