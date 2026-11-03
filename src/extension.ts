import * as vscode from "vscode";
import path from "node:path";
import { explainFindings } from "./ai";
import { groupFindings } from "./findings";
import { normalizeHttpUrl, parseUrlList, ScanInput } from "./inputs";
import { ResultsPanel } from "./resultsPanel";
import { scan } from "./scanner";
import { Finding, ScanReport } from "./types";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("pa11yWebscan.scan", () => startScan(context))
  );
}

export function deactivate(): void {}

async function startScan(context: vscode.ExtensionContext): Promise<void> {
  const input = await chooseInput();
  if (!input) {
    return;
  }

  let currentPanel: ResultsPanel | undefined;
  let aiCancellation: vscode.CancellationTokenSource | undefined;
  const reporterPath = path.join(context.extensionPath, "media", "pa11y-reporter.cjs");
  try {
    const results = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Pa11y accessibility scan",
        cancellable: true
      },
      (progress, token) => scan(
        input,
        reporterPath,
        vscode.workspace.getConfiguration("pa11yWebscan").get<string>("chromeExecutablePath", ""),
        token,
        (url) => progress.report({ message: `Scanning ${url}` })
      )
    );

    const report: ScanReport = {
      createdAt: new Date().toISOString(),
      scannedUrls: Object.keys(results.results),
      results,
      findings: groupFindings(results)
    };

    currentPanel = new ResultsPanel(
      report,
      async () => {
        if (!currentPanel || currentPanel.isDisposed || aiCancellation) {
          return;
        }
        aiCancellation = new vscode.CancellationTokenSource();
        currentPanel.setStatus("Generating explanations. Finding details are sent to the selected VS Code language model.");
        try {
          const explanations = await explainFindings(currentPanel.findings, aiCancellation.token);
          const findings = currentPanel.findings.map((finding) => {
            const explanation = explanations.get(finding.id);
            return explanation
              ? { ...finding, explanation: explanation.explanation, recommendation: explanation.recommendation }
              : finding;
          });
          currentPanel.updateFindings(findings);
          currentPanel.setStatus("AI explanations are ready. Review them before using or sharing the recommendations.");
        } catch (error) {
          currentPanel.setStatus(error instanceof Error ? error.message : String(error));
        } finally {
          aiCancellation.dispose();
          aiCancellation = undefined;
        }
      },
      async (format) => {
        try {
          const markdown = format === "markdown";
          const uri = await vscode.window.showSaveDialog({
            saveLabel: "Save accessibility report",
            filters: markdown ? { Markdown: ["md"] } : { JSON: ["json"] },
            defaultUri: vscode.Uri.joinPath(
              vscode.workspace.workspaceFolders?.[0]?.uri ?? context.globalStorageUri,
              `pa11y-accessibility-report.${markdown ? "md" : "json"}`
            )
          });
          if (!uri || !currentPanel || currentPanel.isDisposed) {
            return;
          }
          const content = currentPanel.export(format);
          await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
          currentPanel.setStatus(`Report saved to ${uri.fsPath}`);
        } catch (error) {
          currentPanel?.setStatus(`Could not save report: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    );
    currentPanel.onDidDispose(() => aiCancellation?.cancel());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message !== "Scan cancelled.") {
      await vscode.window.showErrorMessage(`Pa11y Web Scanner: ${message}`);
    }
  }
}

async function chooseInput(): Promise<ScanInput | undefined> {
  const choice = await vscode.window.showQuickPick(
    [
      { label: "Scan a website URL", description: "Test one HTTP or HTTPS page", inputKind: "url" },
      { label: "Scan a sitemap", description: "Test URLs in a sitemap (including sitemap indexes)", inputKind: "sitemap" },
      { label: "Scan URLs from a text file", description: "One HTTP or HTTPS URL per line; # comments are ignored", inputKind: "urlList" }
    ],
    { placeHolder: "Choose what to scan" }
  );
  if (!choice) {
    return undefined;
  }

  if (choice.inputKind === "url" || choice.inputKind === "sitemap") {
    const rawValue = await vscode.window.showInputBox({
      prompt: choice.inputKind === "sitemap" ? "Enter the sitemap URL" : "Enter the website URL",
      placeHolder: "https://example.com/",
      ignoreFocusOut: true,
      validateInput: (value) => {
        try {
          normalizeHttpUrl(value);
          return undefined;
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      }
    });
    if (!rawValue) {
      return undefined;
    }
    return { kind: choice.inputKind, value: normalizeHttpUrl(rawValue) };
  }

  const files = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: { "Text files": ["txt", "list"], "All files": ["*"] },
    openLabel: "Scan URL list"
  });
  const file = files?.[0];
  if (!file) {
    return undefined;
  }

  try {
    const contents = new TextDecoder().decode(await vscode.workspace.fs.readFile(file));
    return {
      kind: "urlList",
      urls: parseUrlList(contents)
    };
  } catch (error) {
    await vscode.window.showErrorMessage(
      `Could not read the URL list: ${error instanceof Error ? error.message : String(error)}`
    );
    return undefined;
  }
}
