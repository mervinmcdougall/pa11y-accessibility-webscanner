import assert from "node:assert/strict";
import test from "node:test";
import { toJson, toMarkdown } from "../reports";
import { ScanReport } from "../types";

const report: ScanReport = {
  createdAt: "2026-01-01T00:00:00.000Z",
  scannedUrls: ["https://example.com/"],
  results: {
    total: 1,
    passes: 0,
    errors: 1,
    failures: [],
    results: {}
  },
  findings: [{
    id: "finding-1",
    type: "error",
    severity: "Serious",
    code: "test.rule",
    message: "A <b>label</b> is missing",
    count: 1,
    occurrences: [{ url: "https://example.com/", selector: "input[name=q]", context: "<input>" }],
    explanation: "People using screen readers cannot identify this field.",
    recommendation: "Add a visible label and associate it with the field."
  }]
};

test("exports an accessible Markdown report with explanations and occurrences", () => {
  const markdown = toMarkdown(report);
  assert.match(markdown, /Pages scanned: 1/);
  assert.match(markdown, /## Pages scanned/);
  assert.match(markdown, /## Findings by severity/);
  assert.match(markdown, /<span[^>]*>SERIOUS<\/span> \| 1 \|/);
  assert.match(markdown, /## <span[^>]*>SERIOUS<\/span> test\\\.rule/);
  assert.match(markdown, /In plain English/);
  assert.ok(markdown.includes("Selector: `input[name=q]`"));
});

test("exports finding details in Critical, Serious, Moderate, Minor order and sorts titles", () => {
  const findings = [
    { ...report.findings[0], id: "minor-z", severity: "Minor" as const, code: "Zulu" },
    { ...report.findings[0], id: "serious-z", severity: "Serious" as const, code: "Zulu" },
    { ...report.findings[0], id: "critical-z", severity: "Critical" as const, code: "Zulu" },
    { ...report.findings[0], id: "moderate-z", severity: "Moderate" as const, code: "Zulu" },
    { ...report.findings[0], id: "critical-a", severity: "Critical" as const, code: "Alpha" }
  ];
  const markdown = toMarkdown({ ...report, findings });
  const detailTitles = markdown.split("\n").filter((line) => line.startsWith("## <span"));

  assert.deepEqual(detailTitles.map((line) => line.match(/<\/span> ([^ ]+)/)?.[1]), [
    "Alpha",
    "Zulu",
    "Zulu",
    "Zulu",
    "Zulu"
  ]);
  assert.ok(detailTitles[0].includes(">CRITICAL</span>"));
  assert.ok(detailTitles[1].includes(">CRITICAL</span>"));
  assert.ok(detailTitles[2].includes(">SERIOUS</span>"));
  assert.ok(detailTitles[3].includes(">MODERATE</span>"));
  assert.ok(detailTitles[4].includes(">MINOR</span>"));
});

test("exports complete structured JSON", () => {
  const json = JSON.parse(toJson(report));
  assert.equal(json.findings[0].severity, "Serious");
  assert.equal(json.findings[0].explanation, report.findings[0].explanation);
  assert.equal(json.findings[0].occurrences[0].context, "<input>");
});
