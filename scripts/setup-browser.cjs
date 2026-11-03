"use strict";

const { spawnSync } = require("node:child_process");
const { existsSync, rmSync, statSync } = require("node:fs");
const path = require("node:path");

const puppeteer = require("puppeteer");
const executablePath = puppeteer.executablePath();

function isFile(filePath) {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

async function setupBrowser() {
  if (isFile(executablePath)) {
    return;
  }

  const cacheDirectory = path.resolve(puppeteer.default.configuration.cacheDirectory);
  const { getInstalledBrowsers } = require("@puppeteer/browsers");
  const installedBrowsers = await getInstalledBrowsers({ cacheDir: cacheDirectory });
  const collator = new Intl.Collator(undefined, { numeric: true });
  const fallback = installedBrowsers
    .filter((browser) => browser.browser === "chrome" && isFile(browser.executablePath))
    .sort((left, right) => collator.compare(right.buildId, left.buildId))[0];
  if (fallback) {
    // The extension can use this browser as a fallback without replacing the cache.
    console.warn(
      `Puppeteer's pinned Chrome executable is missing; a cached Chrome build is available at "${fallback.executablePath}".`
    );
    return;
  }

  const buildDirectory = path.dirname(path.dirname(path.resolve(executablePath)));
  const relativeBuildDirectory = path.relative(cacheDirectory, buildDirectory);
  const pathParts = relativeBuildDirectory.split(path.sep);
  if (
    path.isAbsolute(relativeBuildDirectory) ||
    pathParts.length !== 2 ||
    pathParts[0] !== "chrome"
  ) {
    throw new Error(`Refusing to repair an unexpected Puppeteer browser path: ${executablePath}`);
  }

  if (existsSync(buildDirectory)) {
    // Puppeteer can mistake a partial previous download for an installed browser.
    rmSync(buildDirectory, { recursive: true, force: true });
  }

  const cliPath = require.resolve("puppeteer/lib/cjs/puppeteer/node/cli.js");
  const result = spawnSync(process.execPath, [cliPath, "browsers", "install", "chrome"], {
    stdio: "inherit"
  });

  if (result.error) {
    throw new Error(`Could not start Puppeteer's browser installer: ${result.error.message}`);
  }
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    return;
  }
  if (!isFile(executablePath)) {
    throw new Error(`Puppeteer finished installing Chrome, but its executable is still missing: ${executablePath}`);
  }
}

setupBrowser().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
