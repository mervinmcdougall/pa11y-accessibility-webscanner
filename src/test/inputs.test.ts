import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHttpUrl, parseUrlList } from "../inputs";

test("normalizes HTTP URLs and rejects unsupported schemes and credentials", () => {
  assert.equal(normalizeHttpUrl(" https://example.com "), "https://example.com/");
  assert.throws(() => normalizeHttpUrl("file:///etc/passwd"), /Only HTTP and HTTPS/);
  assert.throws(() => normalizeHttpUrl("https://user:pass@example.com"), /credentials/);
});

test("parses URL lists, ignores comments and blank lines, and deduplicates URLs", () => {
  assert.deepEqual(
    parseUrlList("# website URLs\nhttps://example.com\n\nhttps://example.com/"),
    ["https://example.com/"]
  );
});

test("reports invalid URL list lines and rejects empty lists", () => {
  assert.throws(() => parseUrlList("https://example.com\nnot a URL"), /Line 2/);
  assert.throws(() => parseUrlList("# no URLs here"), /does not contain any URLs/);
});
