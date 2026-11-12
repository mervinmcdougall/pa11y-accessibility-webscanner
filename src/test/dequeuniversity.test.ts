import assert from "node:assert/strict";
import test from "node:test";
import type { CancellationToken } from "vscode";
import { fetchDequeUniversityContext } from "../dequeuniversity";

function cancellationToken(): CancellationToken {
  return {
    isCancellationRequested: false,
    onCancellationRequested: () => ({ dispose() {} })
  };
}

test("fetches and extracts text from a Deque University URL in the finding message", async () => {
  let requestedUrl = "";
  const fetchRequest: typeof fetch = async (input, init) => {
    requestedUrl = input.toString();
    assert.equal(init?.redirect, "manual");
    return new Response(
      "<html><script>ignore me</script><h1>Accessible name</h1><p>Provide a label &amp; description.</p></html>",
      { headers: { "content-type": "text/html; charset=utf-8" } }
    );
  };

  const result = await fetchDequeUniversityContext(
    "See https://dequeuniversity.com/rules/axe/label?version=4.10.",
    cancellationToken(),
    fetchRequest
  );

  assert.equal(requestedUrl, "https://dequeuniversity.com/rules/axe/label?version=4.10");
  assert.deepEqual(result, {
    url: "https://dequeuniversity.com/rules/axe/label?version=4.10",
    content: "Accessible name Provide a label & description."
  });
});

test("does not fetch unrelated URLs", async () => {
  let requestSent = false;
  const fetchRequest: typeof fetch = async () => {
    requestSent = true;
    return new Response();
  };

  assert.equal(await fetchDequeUniversityContext("See https://example.com/rule", cancellationToken(), fetchRequest), undefined);
  assert.equal(requestSent, false);
});

test("follows redirects that remain on Deque University and cites the final URL", async () => {
  const requestedUrls: string[] = [];
  const fetchRequest: typeof fetch = async (input) => {
    requestedUrls.push(input.toString());
    if (requestedUrls.length === 1) {
      return new Response(null, {
        status: 301,
        headers: { location: "https://www.dequeuniversity.com/rules/axe/label" }
      });
    }
    return new Response("<main><p>Use a visible label.</p></main>", {
      headers: { "content-type": "text/html" }
    });
  };

  const result = await fetchDequeUniversityContext(
    "https://dequeuniversity.com/rules/axe/label",
    cancellationToken(),
    fetchRequest
  );

  assert.deepEqual(requestedUrls, [
    "https://dequeuniversity.com/rules/axe/label",
    "https://www.dequeuniversity.com/rules/axe/label"
  ]);
  assert.deepEqual(result, {
    url: "https://www.dequeuniversity.com/rules/axe/label",
    content: "Use a visible label."
  });
});

test("rejects redirects outside Deque University", async () => {
  let requestCount = 0;
  const fetchRequest: typeof fetch = async () => {
    requestCount += 1;
    return new Response(null, {
      status: 302,
      headers: { location: "https://example.com/redirected" }
    });
  };

  await assert.rejects(
    fetchDequeUniversityContext("https://dequeuniversity.com/rules/axe/label", cancellationToken(), fetchRequest),
    /redirected outside dequeuniversity\.com/
  );
  assert.equal(requestCount, 1);
});
