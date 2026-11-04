import assert from "node:assert/strict";
import Module from "node:module";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import { ScanReport } from "../types";

test("generates syntactically valid executable webview JavaScript", () => {
  const originalRequire = Module.prototype.require;
  let webview: {
    html: string;
    onDidReceiveMessage: () => void;
    postMessage: () => Promise<boolean>;
  } | undefined;
  Module.prototype.require = function (id: string): unknown {
    if (id === "vscode") {
      return {
        window: {
          createWebviewPanel: () => {
            webview = {
              html: "",
              onDidReceiveMessage() {},
              postMessage: async () => true
            };
            return { webview, onDidDispose() {} };
          }
        },
        ViewColumn: { Active: 1 },
        env: { clipboard: { writeText: async () => {} } }
      };
    }
    return originalRequire.call(this, id);
  };

  try {
    const { ResultsPanel } = createRequire(__filename)("../resultsPanel") as typeof import("../resultsPanel");
    const report: ScanReport = {
      createdAt: new Date(0).toISOString(),
      scannedUrls: [],
      results: { total: 0, passes: 0, errors: 0, results: {}, failures: [] },
      findings: []
    };
    new ResultsPanel(report, async () => {}, async () => {});

    assert.ok(webview);
    const executableScripts = [...webview.html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
      .filter(([, attributes, body]) =>
        !/type=["']application\/json["']/i.test(attributes) && body.trim().length > 0
      );
    assert.equal(executableScripts.length, 1);
    for (const [, , source] of executableScripts) {
      new vm.Script(source);
    }
  } finally {
    Module.prototype.require = originalRequire;
  }
});
