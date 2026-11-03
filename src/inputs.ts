export type ScanInput =
  | { kind: "url"; value: string }
  | { kind: "sitemap"; value: string }
  | { kind: "urlList"; urls: string[] };

/** Normalizes an absolute HTTP(S) URL and rejects unsupported schemes or embedded credentials. */
export function normalizeHttpUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`"${value}" is not a valid absolute URL.`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs can be scanned.");
  }
  if (url.username || url.password) {
    throw new Error("URLs containing embedded credentials are not supported.");
  }

  return url.href;
}

/** Parses, validates, and deduplicates URLs from a newline-separated text list. */
export function parseUrlList(contents: string): string[] {
  const urls = new Set<string>();
  const invalid: string[] = [];

  // Line numbers let the user find bad entries without silently skipping URLs.
  for (const [index, rawLine] of contents.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    try {
      urls.add(normalizeHttpUrl(line));
    } catch {
      invalid.push(`Line ${index + 1}: ${line}`);
    }
  }

  if (invalid.length) {
    throw new Error(`The URL list contains invalid entries:\n${invalid.join("\n")}`);
  }
  if (!urls.size) {
    throw new Error("The selected text file does not contain any URLs.");
  }

  return [...urls];
}
