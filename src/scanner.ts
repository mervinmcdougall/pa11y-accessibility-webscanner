import { spawn } from "node:child_process";
import { resolveChromeExecutablePath } from "./browser";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CancellationToken } from "vscode";
import { ScanInput } from "./inputs";
import { ScanIssue, ScanResults } from "./types";

const outputLimit = 64 * 1024 * 1024;
const errorOutputLimit = 1024 * 1024;
const progressPrefix = "PA11Y_PROGRESS:";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toIssue(value: unknown): ScanIssue | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const stringValue = (key: string): string =>
    typeof value[key] === "string" ? value[key] as string : "";
  if (!stringValue("code") && !stringValue("message")) {
    return undefined;
  }

  return {
    type: stringValue("type"),
    code: stringValue("code") || "unknown",
    message: stringValue("message") || "No description provided",
    context: stringValue("context"),
    selector: stringValue("selector"),
    runner: stringValue("runner")
  };
}

function parseResults(stdout: string): ScanResults {
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch {
    throw new Error("Pa11y CI returned invalid JSON output.");
  }
  if (!isRecord(value) || !isRecord(value.results)) {
    throw new Error("Pa11y CI returned an unexpected report format.");
  }

  const results: Record<string, ScanIssue[]> = {};
  for (const [url, rawIssues] of Object.entries(value.results)) {
    if (!Array.isArray(rawIssues)) {
      continue;
    }
    results[url] = rawIssues
      .map(toIssue)
      .filter((issue): issue is ScanIssue => issue !== undefined);
  }

  const failures = Array.isArray(value.failures)
    ? value.failures
      .filter(isRecord)
      .map((failure) => ({
        url: typeof failure.url === "string" ? failure.url : "Unknown URL",
        message: typeof failure.message === "string" ? failure.message : "The page could not be scanned."
      }))
    : [];

  const total = typeof value.total === "number" ? value.total : Object.keys(results).length;
  if (total === 0) {
    throw new Error("Pa11y CI found no pages to scan. Check that the sitemap contains website URLs.");
  }

  return {
    total,
    passes: typeof value.passes === "number" ? value.passes : 0,
    errors: typeof value.errors === "number" ? value.errors : 0,
    results,
    failures
  };
}

export async function scan(
  input: ScanInput,
  reporterPath: string,
  chromeExecutablePath: string,
  token: CancellationToken,
  reportProgress: (url: string) => void
): Promise<ScanResults> {
  if (token.isCancellationRequested) {
    throw new Error("Scan cancelled.");
  }

  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "pa11y-webscan-"));
  try {
    const puppeteerPath = require("puppeteer").executablePath() as string;
    const browserPath = await resolveChromeExecutablePath(chromeExecutablePath, puppeteerPath);
    const configPath = path.join(temporaryDirectory, "pa11yci.json");
    const config = {
      defaults: {
        timeout: 30000,
        concurrency: 1,
        threshold: 0,
        chromeLaunchConfig: { executablePath: browserPath }
      },
      urls: input.kind === "urlList"
        ? input.urls
        : input.kind === "url"
          ? [input.value]
          : []
    };
    await writeFile(configPath, JSON.stringify(config), "utf8");

    const pa11yCiEntry = require.resolve("pa11y-ci");
    const cliPath = path.resolve(path.dirname(pa11yCiEntry), "../bin/pa11y-ci.js");
    const args = [
      cliPath,
      "--config", configPath,
      "--reporter", reporterPath,
      "--threshold", "2147483647"
    ];
    if (input.kind === "sitemap") {
      args.push("--sitemap", input.value);
    }

    return await new Promise<ScanResults>((resolve, reject) => {
      const child = spawn(process.execPath, args, {
        cwd: temporaryDirectory,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"]
      });
      let stdout = "";
      let stderr = "";
      let stderrLineBuffer = "";
      let settled = false;
      let cancelled = false;
      let outputTooLarge = false;

      const finishError = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(error);
      };

      const cancellationSubscription = token.onCancellationRequested(() => {
        cancelled = true;
        child.kill();
      });

      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
        if (Buffer.byteLength(stdout, "utf8") > outputLimit) {
          outputTooLarge = true;
          child.kill();
        }
      });

      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
        if (Buffer.byteLength(stderr, "utf8") > errorOutputLimit) {
          stderr = stderr.slice(-errorOutputLimit);
        }
        stderrLineBuffer += chunk;
        const lines = stderrLineBuffer.split(/\r?\n/);
        stderrLineBuffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith(progressPrefix)) {
            continue;
          }
          try {
            const event: unknown = JSON.parse(line.slice(progressPrefix.length));
            if (isRecord(event) && typeof event.url === "string") {
              reportProgress(event.url);
            }
          } catch {
            // Ignore malformed progress events; the final process result remains authoritative.
          }
        }
      });

      child.on("error", (error) => {
        cancellationSubscription.dispose();
        finishError(new Error(`Unable to start Pa11y CI: ${error.message}`));
      });

      child.on("close", (code, signal) => {
        cancellationSubscription.dispose();
        if (cancelled || token.isCancellationRequested) {
          finishError(new Error("Scan cancelled."));
          return;
        }
        if (outputTooLarge) {
          finishError(new Error("Pa11y CI output exceeded the 64 MB safety limit."));
          return;
        }
        if (code !== 0 && code !== 2) {
          finishError(new Error(
            `Pa11y CI failed${signal ? ` (${signal})` : ` with exit code ${code}`}. ${stderr.trim()}`
          ));
          return;
        }
        try {
          resolve(parseResults(stdout));
        } catch (error) {
          finishError(error instanceof Error ? error : new Error(String(error)));
        }
      });
    });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
