# Copilot instructions

## Build, test, and package

- `npm run compile` compiles the strict TypeScript project to `out/`.
- `npm test` compiles and runs the Node test runner against `out/test/*.test.js`.
- Run one test file with `npm run compile && node --test out/test/findings.test.js` (substitute another compiled file under `out/test/` as needed). To select an individual test, add `-- --test-name-pattern="sorts findings"`.
- `npm run setup-browser` installs or checks Puppeteer's pinned Chrome and can use a valid cached Chrome when that exact build is unavailable. The VS Code F5 launch task runs browser setup automatically.
- `npm run package -- --out /tmp/pa11y-webscan.vsix` builds and packages the VS Code extension. `npm run watch` runs TypeScript in watch mode.
- There is no lint script configured in `package.json`.

## Architecture

This repository is a TypeScript VS Code extension. `src/extension.ts` registers the scan command, gathers user input, runs a cancellable progress operation, then connects the scan results to the report view, AI explanations, and export actions.

The scan pipeline runs Pa11y CI as a child process from `src/scanner.ts`, using an isolated temporary config/report directory. `media/pa11y-reporter.cjs` writes the JSON report to the path passed through `PA11Y_REPORT_PATH`; keep report data separate from stdout/stderr, which carry process diagnostics and progress. Inputs in `src/inputs.ts` normalize single URLs and parse text URL lists; sitemap expansion is delegated to Pa11y CI.

`src/scanner.ts` normalizes Pa11y output into `ScanResults` and preserves axe's `runnerExtras.impact`. `src/findings.ts` groups repeated rule/message/impact findings while retaining each URL and selector, assigns severity, and sorts findings. `src/severity.ts` maps axe impacts directly to Critical/Serious/Moderate/Minor; HTML_CodeSniffer results without impact map Pa11y error/warning/notice to Serious/Moderate/Minor.

`src/resultsPanel.ts` renders the interactive VS Code webview and sends user actions to the extension host. It uses a strict CSP, nonce-bearing scripts, and text-node rendering for untrusted scan/model content. `src/ai.ts` makes opt-in, batched requests through the VS Code Language Model API. `src/reports.ts` creates Markdown and JSON exports; Markdown should use the same severity/title ordering as the results view.

## Repository-specific conventions

- Keep scan normalization, severity assignment, and finding ordering in the shared modules (`scanner`, `severity`, and `findings`) so the webview and exported reports stay consistent.
- Findings sort by Critical, Serious, Moderate, Minor, then case-insensitive rule code/title, with message as a tie-breaker. Counts represent occurrences; do not deduplicate away affected-page or selector details.
- Page-level navigation/browser failures are stored separately from accessibility issues in `ScanResults.failures`; preserve partial scan reports and show those failures rather than failing the entire run.
- Browser selection honors `pa11yWebscan.chromeExecutablePath`, otherwise uses Puppeteer's pinned executable and then a valid cached Chrome fallback. Keep missing-browser errors actionable and maintain the setup script/debugger prelaunch task when changing browser setup.
- AI explanation requests are initiated by the user; page-derived finding data is untrusted input. Keep it explicitly framed as data in prompts and render model responses as text, not HTML.
- The scanner intentionally configures both `axe` and `htmlcs`, includes warnings/notices, and raises the run threshold so accessibility findings appear in the report instead of making the scan fail.
- Extension tests use Node's built-in `node:test` and compile into `out/test/`; test pure parsing, severity, aggregation, and report behavior independently where possible.

## Project guidance

`README.md` documents the local browser requirement, debugger setup, scan inputs, opt-in AI data handling, severity mapping, and the limitation that automated scans do not replace manual accessibility testing.
