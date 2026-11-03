import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { chooseChromeExecutablePath, resolveChromeExecutablePath } from "../browser";

test("uses a configured browser executable when it exists", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pa11y-browser-test-"));
  const browserPath = path.join(directory, "chrome");
  try {
    await writeFile(browserPath, "");
    assert.equal(chooseChromeExecutablePath(browserPath, "/missing/puppeteer-chrome"), browserPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("reports how to install Puppeteer's pinned browser when it is missing", async () => {
  await assert.rejects(
    Promise.resolve().then(() =>
      chooseChromeExecutablePath("", "/missing/puppeteer-chrome", ["/missing/cached-chrome"])
    ),
    /npm run setup-browser/
  );
});

test("points to the VS Code setting when a configured browser is missing", async () => {
  await assert.rejects(
    Promise.resolve().then(() =>
      chooseChromeExecutablePath("/missing/chrome", "/missing/puppeteer-chrome")
    ),
    /Chrome Executable Path/
  );
});

test("uses a different valid cached Chrome when the pinned browser is missing", async () => {
  const browserPath = process.execPath;
  assert.equal(
    chooseChromeExecutablePath("", "/missing/puppeteer-chrome", [browserPath]),
    browserPath
  );
});
