import { createHash } from "node:crypto";
import { severityForType } from "./severity";
import { Finding, ScanIssue, ScanResults, Severity } from "./types";

const severityOrder: Record<Severity, number> = {
  Critical: 0,
  Serious: 1,
  Moderate: 2,
  Minor: 3
};

function findingTitle(finding: Finding): string {
  return finding.code || finding.message;
}

export function sortFindings(findings: Finding[]): Finding[] {
  // Keep the most severe findings first; titles and messages make ties predictable.
  return [...findings].sort((left, right) =>
    severityOrder[left.severity] - severityOrder[right.severity] ||
    findingTitle(left).localeCompare(findingTitle(right), undefined, { sensitivity: "base" }) ||
    left.message.localeCompare(right.message, undefined, { sensitivity: "base" })
  );
}

function stableKey(issue: ScanIssue): string {
  // Include axe impact so distinct severity levels for the same rule stay separate.
  return [
    issue.code.trim().toLowerCase(),
    issue.message.trim().toLowerCase().replace(/\s+/g, " "),
    issue.impact?.trim().toLowerCase() ?? ""
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
          severity: severityForType(issue.type, issue.impact),
          ...(issue.impact ? { impact: issue.impact } : {}),
          code: issue.code,
          message: issue.message,
          count: 0,
          occurrences: []
        };
        grouped.set(key, finding);
      }

      // Aggregate repeated instances while keeping every page and selector for review.
      finding.count += 1;
      finding.occurrences.push({
        url,
        selector: issue.selector,
        context: issue.context
      });
    }
  }

  return sortFindings([...grouped.values()]);
}
