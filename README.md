# Pa11y Accessibility Web Scanner

A Visual Studio Code extension for running [Pa11y CI](https://github.com/pa11y/pa11y-ci) against a website URL, sitemap, or newline-delimited URL text file. It groups matching findings across pages, keeps each original page and selector, and provides optional plain-English explanations through the VS Code Language Model API or an OpenAI-compatible API.

Automated accessibility scans can identify many common issues, but they do not prove that a site is accessible or replace manual testing with assistive technologies.

## Features

- Scan one HTTP/HTTPS URL, a sitemap URL (including sitemap indexes), or URLs from a text file.
- Ignore blank lines and lines beginning with `#` in URL list files; repeated URLs are scanned once.
- Review grouped issues, original messages, affected pages, selectors, and HTML context in a VS Code results view.
- See a color-coded severity summary with occurrence counts, and matching severity tags beside each detailed finding.
- Page-level navigation or browser failures are listed in the results alongside findings from pages that scanned successfully.
- Ask a VS Code language model or an OpenAI-compatible API for plain-English explanations and practical suggestions.
- Export the report to Markdown or JSON.
- Cancel an active Pa11y CI process.

The scanner runs locally through the extension host. AI explanations are opt-in: details for an individual finding are sent to the configured AI provider only when the user chooses **Explain this finding with AI** on that finding. Model availability, sign-in, and data handling depend on that provider. External API keys are stored in VS Code SecretStorage; when using an external provider, finding details are sent to the configured service and may incur charges under its account.
Findings are assessed with both axe and HTML_CodeSniffer, including warnings and notices. Axe impact values map directly to Critical, Serious, Moderate, and Minor. Findings without an axe impact (for example, HTML_CodeSniffer results) map Pa11y errors to Serious, warnings to Moderate, and notices to Minor; Critical is only assigned when axe explicitly reports critical impact.

## Requirements

- Visual Studio Code 1.96 or later.
- Node.js 20 or later for developing and running the extension.
- An available VS Code Language Model provider or an OpenAI-compatible Chat Completions API for AI explanations; scans and exports work without either.
- A Chromium browser. If Puppeteer's browser cache is unavailable, set `pa11yWebscan.chromeExecutablePath` to a local Chrome/Chromium executable.

The extension includes Pa11y CI 4.1.1. Pa11y CI uses the Chrome build pinned by Puppeteer. Dependency install scripts may be disabled by a package manager, or VS Code Marketplace/VSIX installs do not run them; in either case, install the browser with `npm run setup-browser` during development, or configure a local executable for a packaged extension. The setup command also repairs an incomplete cached Chrome download. If a browser cannot start, review the [Pa11y CI troubleshooting guide](https://github.com/pa11y/pa11y/blob/main/TROUBLESHOOTING.md).

To configure a local browser, set **Pa11y Accessibility Web Scanner › Chrome Executable Path** in VS Code settings to the full executable path.

## AI provider configuration

The default provider is the VS Code Language Model API. To use OpenAI or another compatible Chat Completions service:

1. Set **Pa11y Accessibility Web Scanner: AI Provider** to `openaiCompatible`.
2. Set **AI API Base URL** (OpenAI defaults to `https://api.openai.com/v1`) and **AI Model** to a model available to your account.
3. Run **Pa11y Accessibility Web Scanner: Set AI API Key** from the Command Palette and enter the key. It is stored using VS Code SecretStorage, not in settings.

Run **Pa11y Accessibility Web Scanner: Clear AI API Key** to remove the saved key. Use a trusted HTTPS endpoint; local HTTP endpoints are allowed for development. The configured service receives the scan finding details only when you request AI explanations. API access and charges are controlled by that service.

## Use

1. Run **Pa11y Accessibility Web Scanner: Start Scan** from the Command Palette.
2. Choose a URL, sitemap, or text file of URLs.
3. Review the grouped scan results. Choose **Explain this finding with AI** on a finding to request its explanation in a popup, or export the report as Markdown or JSON.

URL list files should contain one absolute HTTP/HTTPS URL per line. Blank lines and `#` comments are ignored. Invalid entries are reported before the scan begins.

## Develop

```sh
npm install
npm run setup-browser
npm test
```

Open the project in VS Code and press **F5** to launch an Extension Development Host. The included debugger configuration installs Puppeteer's pinned Chrome build before launching. The extension activates when its scan command is run.

## License

This extension is licensed under Apache-2.0. Pa11y CI is distributed under LGPL-3.0-only; its license is included with the dependency.
