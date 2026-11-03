import { Finding, Severity } from "./types";

export type { Severity } from "./types";

/** Maps axe impact to severity, falling back to the Pa11y result type. */
export function severityForType(type: string, impact?: string): Severity {
  // Use axe's direct impact value where available; Pa11y levels are only a fallback.
  switch (impact?.trim().toLowerCase()) {
    case "critical":
      return "Critical";
    case "serious":
      return "Serious";
    case "moderate":
      return "Moderate";
    case "minor":
      return "Minor";
  }

  switch (type.trim().toLowerCase()) {
    case "error":
      return "Serious";
    case "warning":
      return "Moderate";
    case "notice":
      return "Minor";
    default:
      return "Minor";
  }
}

/** Totals issue occurrences for each severity level. */
export function summarizeSeverities(
  findings: Finding[]
): Array<{ severity: Severity; count: number }> {
  const counts = new Map<Severity, number>([
    ["Critical", 0],
    ["Serious", 0],
    ["Moderate", 0],
    ["Minor", 0]
  ]);

  for (const finding of findings) {
    counts.set(finding.severity, (counts.get(finding.severity) ?? 0) + finding.count);
  }

  return [...counts.entries()]
    .map(([severity, count]) => ({ severity, count }));
}
