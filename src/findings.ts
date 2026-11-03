import { createHash } from "node:crypto";
import { Finding, ScanIssue, ScanResults } from "./types";

function stableKey(issue: ScanIssue): string {
  return [
    issue.code.trim().toLowerCase(),
    issue.message.trim().toLowerCase().replace(/\s+/g, " ")
  ].join("\u0000");
}

export function groupFindings(results: ScanResults): Finding[] {
  const grouped = new Map<string, Finding>();

  for (const [url, issues] of Object.entries(results.results)) {
    for (const issue of issues) {
      const key = stableKey(issue);
      let finding = grouped.get(key);
      if (!finding) {
        finding = {
          id: createHash("sha256").update(key).digest("hex").slice(0, 12),
          type: issue.type,
          code: issue.code,
          message: issue.message,
          count: 0,
          occurrences: []
        };
        grouped.set(key, finding);
      }

      finding.count += 1;
      finding.occurrences.push({
        url,
        selector: issue.selector,
        context: issue.context
      });
    }
  }

  return [...grouped.values()].sort((left, right) =>
    left.code.localeCompare(right.code) || left.message.localeCompare(right.message)
  );
}
