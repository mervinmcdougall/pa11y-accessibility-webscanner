import { statSync } from "node:fs";

function isFile(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function chooseChromeExecutablePath(
  configuredPath: string,
  puppeteerPath: string,
  cachedChromePaths: string[] = []
): string {
  const configured = configuredPath.trim();
  if (configured) {
    if (isFile(configured)) {
      return configured;
    }
    throw new Error(
      `The configured Chrome executable was not found at "${configured}". ` +
      "Update Pa11y Web Scanner › Chrome Executable Path in VS Code settings."
    );
  }

  if (isFile(puppeteerPath)) {
    return puppeteerPath;
  }

  // Prefer a usable cached Chrome over forcing a large download of Puppeteer's pinned build.
  const cachedChrome = cachedChromePaths.find(isFile);
  if (cachedChrome) {
    return cachedChrome;
  }

  throw new Error(
    `Puppeteer's required Chrome browser was not found at "${puppeteerPath}", and no other cached Chrome build is available. ` +
    'From the extension project, run "npm run setup-browser" and retry. ' +
    "Alternatively, set Pa11y Web Scanner › Chrome Executable Path to an installed Chrome or Chromium executable."
  );
}

export async function resolveChromeExecutablePath(
  configuredPath: string,
  puppeteerPath: string
): Promise<string> {
  if (configuredPath.trim() || isFile(puppeteerPath)) {
    return chooseChromeExecutablePath(configuredPath, puppeteerPath);
  }

  const puppeteer = require("puppeteer");
  const { getInstalledBrowsers } = require("@puppeteer/browsers");
  const installedBrowsers = await getInstalledBrowsers({
    cacheDir: puppeteer.default.configuration.cacheDirectory
  });
  const collator = new Intl.Collator(undefined, { numeric: true });
  const cachedChromePaths = installedBrowsers
    .filter((browser: { browser: string; executablePath: string }) =>
      browser.browser === "chrome" && isFile(browser.executablePath)
    )
    .sort((left: { buildId: string }, right: { buildId: string }) =>
      collator.compare(right.buildId, left.buildId)
    )
    .map((browser: { executablePath: string }) => browser.executablePath);
  return chooseChromeExecutablePath(configuredPath, puppeteerPath, cachedChromePaths);
}
