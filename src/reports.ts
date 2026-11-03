import { ScanReport } from "./types";
import { summarizeSeverities } from "./severity";
import { sortFindings } from "./findings";

function markdownText(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+.!|>-]/g, "\\$&");
}

function severityTag(severity: string): string {
  const colors = {
    Critical: { background: "#fde8e7", foreground: "#a4262c" },
    Serious: { background: "#fce8d5", foreground: "#8a3b00" },
    Moderate: { background: "#fff4ce", foreground: "#7a4f01" },
    Minor: { background: "#e8f2ff", foreground: "#174ea6" }
  };
  const color = colors[severity as keyof typeof colors] ?? colors.Minor;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:12px;background-color:${color.background};color:${color.foreground};font-weight:600">${severity.toUpperCase()}</span>`;
}

export function toMarkdown(report: ScanReport): string {
  const lines = [
    "# Pa11y Accessibility Scan",
    "",
    `- Generated: ${report.createdAt}`,
    `- Pages scanned: ${report.results.total}`,
    `- Accessibility issues: ${report.findings.reduce((count, finding) => count + finding.count, 0)}`,
    `- Deduplicated findings: ${report.findings.length}`,
    "",
    "Automated accessibility checks do not replace manual testing with assistive technologies.",
    ""
  ];

  if (report.scannedUrls.length) {
    lines.push("## Pages scanned", "");
    for (const url of report.scannedUrls) {
      lines.push(`- ${markdownText(url)}`);
    }
    lines.push("");
  }

  lines.push("## Findings by severity", "", "| Severity | Number found |", "| --- | ---: |");
  for (const { severity, count } of summarizeSeverities(report.findings)) {
    lines.push(`| ${severityTag(severity)} | ${count} |`);
  }
  lines.push("");

  if (!report.findings.length) {
    lines.push("No accessibility findings were returned by the scan.", "");
  }

  for (const finding of sortFindings(report.findings)) {
    lines.push(
      `## ${severityTag(finding.severity)} ${markdownText(finding.code)} (${finding.count} occurrence${finding.count === 1 ? "" : "s"})`,
      "",
      markdownText(finding.message),
      ""
    );
    if (finding.explanation) {
      lines.push(`**In plain English:** ${markdownText(finding.explanation)}`, "");
    }
    if (finding.recommendation) {
      lines.push(`**Suggested fix:** ${markdownText(finding.recommendation)}`, "");
    }

    for (const occurrence of finding.occurrences) {
      lines.push(
        `- ${markdownText(occurrence.url)}`,
        `  - Selector: \`${occurrence.selector.replace(/`/g, "\\`")}\``,
        occurrence.context ? `  - Context: ${markdownText(occurrence.context)}` : ""
      );
    }
    lines.push("");
  }

  if (report.results.failures.length) {
    lines.push("## Pages that could not be scanned", "");
    for (const failure of report.results.failures) {
      lines.push(`- ${markdownText(failure.url)}: ${markdownText(failure.message)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function toJson(report: ScanReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
