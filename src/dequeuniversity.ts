import type { CancellationToken } from "vscode";

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 100_000;
const MAX_CONTEXT_CHARACTERS = 12_000;
const FETCH_TIMEOUT_MS = 15_000;

export interface DequeUniversityContext {
  url: string;
  content: string;
}

function isDequeUniversityUrl(url: URL): boolean {
  return url.protocol === "https:" &&
    (url.hostname === "dequeuniversity.com" || url.hostname.endsWith(".dequeuniversity.com")) &&
    !url.username &&
    !url.password &&
    !url.port;
}

function candidateUrls(text: string): URL[] {
  const urls: URL[] = [];
  for (const match of text.matchAll(/https:\/\/[^\s<>"']+/gi)) {
    let candidate = match[0];
    while (/[.,;!?]$/.test(candidate)) {
      candidate = candidate.slice(0, -1);
    }
    while (candidate.endsWith(")") && (candidate.match(/\)/g)?.length ?? 0) > (candidate.match(/\(/g)?.length ?? 0)) {
      candidate = candidate.slice(0, -1);
    }
    try {
      const url = new URL(candidate);
      if (isDequeUniversityUrl(url)) {
        urls.push(url);
      }
    } catch {
      // Ignore malformed URLs found in scan messages.
    }
  }
  return urls;
}

async function readLimitedText(response: Response): Promise<string> {
  if (!response.body) {
    return "";
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (totalBytes < MAX_RESPONSE_BYTES) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const remaining = MAX_RESPONSE_BYTES - totalBytes;
      const chunk = value.subarray(0, remaining);
      chunks.push(chunk);
      totalBytes += chunk.byteLength;
      if (chunk.byteLength < value.byteLength) {
        await reader.cancel();
        break;
      }
    }
    if (totalBytes >= MAX_RESPONSE_BYTES) {
      await reader.cancel();
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function htmlToText(html: string): string {
  const article = html.match(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1\s*>/i)?.[2] ?? html;
  const text = article
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, value: string) => {
      const namedEntities: Record<string, string> = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: "\"",
        apos: "'",
        nbsp: " "
      };
      if (!value.startsWith("#")) {
        return namedEntities[value.toLowerCase()] ?? entity;
      }
      const codePoint = value[1]?.toLowerCase() === "x"
        ? Number.parseInt(value.slice(2), 16)
        : Number.parseInt(value.slice(1), 10);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    });
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_CONTEXT_CHARACTERS);
}

/** Fetches bounded plain-text context only from Deque University HTTPS pages. */
export async function fetchDequeUniversityContext(
  message: string,
  token: CancellationToken,
  fetchRequest: typeof fetch = fetch
): Promise<DequeUniversityContext | undefined> {
  let url = candidateUrls(message)[0];
  if (!url) {
    return undefined;
  }
  if (token.isCancellationRequested) {
    throw new Error("AI explanation cancelled.");
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, FETCH_TIMEOUT_MS);
  const cancellation = token.onCancellationRequested(() => controller.abort());
  try {
    for (let redirects = 0; ; redirects += 1) {
      if (token.isCancellationRequested) {
        throw new Error("AI explanation cancelled.");
      }
      const response = await fetchRequest(url, {
        method: "GET",
        headers: { "Accept": "text/html, application/xhtml+xml, text/plain" },
        redirect: "manual",
        signal: controller.signal
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirects >= MAX_REDIRECTS) {
          throw new Error("The Deque University source redirected too many times or omitted its redirect target.");
        }
        let nextUrl: URL;
        try {
          nextUrl = new URL(location, url);
        } catch {
          throw new Error("The Deque University source returned an invalid redirect URL.");
        }
        if (!isDequeUniversityUrl(nextUrl)) {
          throw new Error("The Deque University source redirected outside dequeuniversity.com.");
        }
        url = nextUrl;
        continue;
      }
      if (!response.ok) {
        throw new Error(`The Deque University source request failed (HTTP ${response.status}).`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!/^(text\/html|application\/xhtml\+xml|text\/plain)(?:\s*;|$)/i.test(contentType)) {
        throw new Error("The Deque University source did not return an HTML or text page.");
      }
      const body = await readLimitedText(response);
      const content = contentType.toLowerCase().startsWith("text/plain")
        ? body.trim().slice(0, MAX_CONTEXT_CHARACTERS)
        : htmlToText(body);
      if (!content) {
        throw new Error("The Deque University source did not contain readable text.");
      }
      return { url: url.href, content };
    }
  } catch (error) {
    if (token.isCancellationRequested) {
      throw new Error("AI explanation cancelled.");
    }
    if (timedOut) {
      throw new Error("Fetching the Deque University source timed out.");
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Fetching the Deque University source was interrupted.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    cancellation.dispose();
  }
}
