import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import { ScanReport, Finding } from "./types";
import { toJson, toMarkdown } from "./reports";
import { summarizeSeverities } from "./severity";

type ExportFormat = "markdown" | "json";

export class ResultsPanel {
  private readonly panel: vscode.WebviewPanel;
  private disposed = false;

  /** Creates the results webview and wires its actions to the supplied handlers. */
  constructor(
    private report: ScanReport,
    private readonly onExplain: () => Promise<void>,
    private readonly onExport: (format: ExportFormat) => Promise<void>
  ) {
    this.panel = vscode.window.createWebviewPanel(
      "pa11yWebscanResults",
      "Pa11y Accessibility Results",
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        // The report is self-contained and does not need to load extension or workspace files.
        localResourceRoots: []
      }
    );
    this.panel.webview.html = this.createHtml();
    this.panel.webview.onDidReceiveMessage((message: unknown) => {
      if (typeof message !== "object" || message === null || !("type" in message)) {
        return;
      }
      if (message.type === "explain") {
        void this.onExplain();
      } else if (message.type === "exportMarkdown") {
        void this.onExport("markdown");
      } else if (message.type === "exportJson") {
        void this.onExport("json");
      }
    });
    this.panel.onDidDispose(() => {
      this.disposed = true;
    });
  }

  /** Indicates whether the user has closed the results panel. */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /** Returns the current findings displayed and exported by this panel. */
  get findings(): Finding[] {
    return this.report.findings;
  }

  /** Registers a listener for when the results panel is disposed. */
  onDidDispose(listener: () => void): vscode.Disposable {
    return this.panel.onDidDispose(listener);
  }

  /** Replaces the findings and refreshes the webview. */
  updateFindings(findings: Finding[]): void {
    this.report = { ...this.report, findings };
    void this.panel.webview.postMessage({ type: "findings", findings });
  }

  /** Updates the webview's accessible status message. */
  setStatus(message: string): void {
    void this.panel.webview.postMessage({ type: "status", message });
  }

  /** Serializes the current report in the requested format. */
  export(format: ExportFormat): string {
    return format === "markdown" ? toMarkdown(this.report) : toJson(this.report);
  }

  /** Builds the self-contained, nonce-protected webview and its initial report data. */
  private createHtml(): string {
    const nonce = randomBytes(16).toString("base64");
    // Escape '<' before embedding scan/model content in the inline JSON script element.
    const initialData = JSON.stringify({
      summary: {
        total: this.report.results.total,
        issueCount: this.report.findings.reduce((count, finding) => count + finding.count, 0),
        failures: this.report.results.failures
      },
      severityCounts: summarizeSeverities(this.report.findings),
      findings: this.report.findings
    }).replace(/</g, "\\u003c");
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <title>Pa11y Accessibility Results</title>
  <style nonce="${nonce}">
    body { color: var(--vscode-foreground); font-family: var(--vscode-font-family); padding: 0 1.5rem 2rem; }
    h1 { font-size: 1.5rem; }
    .summary, .finding { border: 1px solid var(--vscode-panel-border); border-radius: 6px; margin: 1rem 0; padding: 1rem; }
    .severity-table { border-collapse: collapse; width: auto; }
    .severity-table th, .severity-table td { border-bottom: 1px solid var(--vscode-panel-border); padding: .5rem .75rem; text-align: left; }
    .severity-table td:last-child, .severity-table th:last-child { text-align: right; }
    .severity-tag { border-radius: 999px; display: inline-block; font-size: .75rem; font-weight: 700; padding: .15rem .55rem; }
    .severity-critical { background: #fde8e7; color: #a4262c; }
    .severity-serious { background: #fce8d5; color: #8a3b00; }
    .severity-moderate { background: #fff4ce; color: #7a4f01; }
    .severity-minor { background: #e8f2ff; color: #174ea6; }
    .actions { display: flex; flex-wrap: wrap; gap: .5rem; margin: 1rem 0; }
    button { background: var(--vscode-button-background); border: 0; border-radius: 2px; color: var(--vscode-button-foreground); cursor: pointer; padding: .5rem .8rem; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    #status { min-height: 1.4em; }
    .muted, .context { color: var(--vscode-descriptionForeground); }
    .finding h2 { font-size: 1.05rem; }
    .occurrences { padding-left: 1.25rem; }
    .occurrences li { margin: .75rem 0; overflow-wrap: anywhere; }
    pre { overflow-x: auto; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>Pa11y Accessibility Results</h1>
  <section id="summary" class="summary" aria-label="Scan summary"></section>
  <div class="actions">
    <button id="explain" type="button">Explain findings with AI</button>
    <button id="exportMarkdown" type="button">Export Markdown</button>
    <button id="exportJson" type="button">Export JSON</button>
  </div>
  <p id="status" role="status" aria-live="polite"></p>
  <main id="findings"></main>
  <script nonce="${nonce}" id="initial-data" type="application/json">${initialData}</script>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const initial = JSON.parse(document.getElementById("initial-data").textContent);
    const summary = document.getElementById("summary");
    const findingsRoot = document.getElementById("findings");
    const status = document.getElementById("status");

    /** Creates an element with untrusted content assigned as text, not markup. */
    function textElement(tag, text, className) {
      const element = document.createElement(tag);
      // Scan context and model output are untrusted; render them as text, never HTML.
      element.textContent = text;
      if (className) element.className = className;
      return element;
    }

    /** Renders the scan summary, failures, and finding details into the webview. */
    function render(findings) {
      summary.replaceChildren(
        textElement("p", initial.summary.total + " pages scanned"),
        textElement("p", initial.summary.issueCount + " issues found across " + findings.length + " deduplicated findings")
      );
      const severityHeading = textElement("h2", "Findings by severity");
      const severityTable = document.createElement("table");
      severityTable.className = "severity-table";
      severityTable.setAttribute("aria-label", "Findings by severity");
      const tableHead = document.createElement("thead");
      const headerRow = document.createElement("tr");
      headerRow.append(textElement("th", "Severity"));
      headerRow.append(textElement("th", "Number found"));
      tableHead.append(headerRow);
      severityTable.append(tableHead);
      const tableBody = document.createElement("tbody");
      for (const entry of initial.severityCounts) {
        const row = document.createElement("tr");
        const severityCell = document.createElement("td");
        const severityTag = textElement("span", entry.severity, "severity-tag severity-" + entry.severity.toLowerCase());
        severityCell.append(severityTag);
        row.append(severityCell);
        row.append(textElement("td", String(entry.count)));
        tableBody.append(row);
      }
      severityTable.append(tableBody);
      summary.append(severityHeading, severityTable);
      if (initial.summary.failures.length) {
        summary.append(textElement("h2", "Pages that could not be scanned"));
        const failures = document.createElement("ul");
        for (const failure of initial.summary.failures) {
          failures.append(textElement("li", failure.url + ": " + failure.message));
        }
        summary.append(failures);
      }
      findingsRoot.replaceChildren();
      if (!findings.length) {
        findingsRoot.append(textElement("p", "No accessibility findings were returned by the scan."));
        return;
      }
      for (const finding of findings) {
        const article = document.createElement("article");
        article.className = "finding";
        const heading = document.createElement("h2");
        const severityLabel = finding.severity.toLowerCase();
        heading.append(
          textElement("span", severityLabel.toUpperCase(), "severity-tag severity-" + severityLabel),
          document.createTextNode(" " + finding.code)
        );
        article.append(heading);
        article.append(textElement("p", finding.message));
        article.append(textElement("p", finding.count + " occurrence(s)", "muted"));
        if (finding.explanation) {
          article.append(textElement("h3", "In plain English"));
          article.append(textElement("p", finding.explanation));
        }
        if (finding.recommendation) {
          article.append(textElement("h3", "Suggested fix"));
          article.append(textElement("p", finding.recommendation));
        }
        const list = document.createElement("ul");
        list.className = "occurrences";
        for (const occurrence of finding.occurrences) {
          const item = document.createElement("li");
          item.append(textElement("p", occurrence.url));
          item.append(textElement("p", "Selector: " + (occurrence.selector || "(not provided)"), "muted"));
          if (occurrence.context) {
            item.append(textElement("pre", occurrence.context, "context"));
          }
          list.append(item);
        }
        article.append(list);
        findingsRoot.append(article);
      }
    }

    document.getElementById("explain").addEventListener("click", () => {
      status.textContent = "Requesting plain-English explanations…";
      vscode.postMessage({ type: "explain" });
    });
    document.getElementById("exportMarkdown").addEventListener("click", () => vscode.postMessage({ type: "exportMarkdown" }));
    document.getElementById("exportJson").addEventListener("click", () => vscode.postMessage({ type: "exportJson" }));
    window.addEventListener("message", (event) => {
      if (event.data.type === "findings") render(event.data.findings);
      if (event.data.type === "status") status.textContent = event.data.message;
    });
    render(initial.findings);
  </script>
</body>
</html>`;
  }
}
