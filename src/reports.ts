import { ScanReport } from "./types";

function markdownText(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+.!|>-]/g, "\\$&");
}

export function toMarkdown(report: ScanReport): string {
  const lines = [
    "# Pa11y Accessibility Scan",
    "",
    `- Generated: ${report.createdAt}`,
    `- Pages scanned: ${report.results.total}`,
    `- Accessibility issues: ${report.results.errors}`,
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

  if (!report.findings.length) {
    lines.push("No accessibility findings were returned by the scan.", "");
  }

  for (const finding of report.findings) {
    lines.push(
      `## ${markdownText(finding.code)} (${finding.count} occurrence${finding.count === 1 ? "" : "s"})`,
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
