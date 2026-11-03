import type { CancellationToken } from "vscode";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  error?: {
    message?: unknown;
  };
}

/** Extracts text from a successful OpenAI-compatible Chat Completions response. */
export function parseChatCompletionResponse(status: number, body: string, apiKey?: string): string {
  let value: ChatCompletionResponse;
  try {
    value = JSON.parse(body) as ChatCompletionResponse;
  } catch {
    throw new Error(`The AI service returned an invalid response (HTTP ${status}).`);
  }

  if (status < 200 || status >= 300) {
    const errorMessage = typeof value.error?.message === "string"
      ? value.error.message.slice(0, 300)
      : "";
    const safeMessage = apiKey ? errorMessage.split(apiKey).join("[redacted]") : errorMessage;
    const message = safeMessage ? `: ${safeMessage}` : "";
    throw new Error(`The AI service request failed (HTTP ${status})${message}.`);
  }

  const content = value.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((part): part is { type: "text"; text: string } =>
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string"
      )
      .map((part) => part.text)
      .join("");
  }
  return "";
}

/** Sends the prompt to an OpenAI-compatible Chat Completions endpoint. */
export async function requestChatCompletion(
  prompt: string,
  baseUrl: string,
  model: string,
  apiKey: string,
  token: CancellationToken,
  fetchRequest: typeof fetch = fetch
): Promise<string> {
  let endpoint: URL;
  try {
    endpoint = new URL(`${baseUrl.replace(/\/+$/, "")}/chat/completions`);
  } catch {
    throw new Error("The configured AI API base URL is invalid.");
  }
  if (
    (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    (endpoint.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname))
  ) {
    throw new Error("The AI API base URL must use HTTPS (or local HTTP) and must not contain credentials, query, or fragment.");
  }

  const controller = new AbortController();
  const cancellation = token.onCancellationRequested(() => controller.abort());
  try {
    const response = await fetchRequest(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }]
      }),
      signal: controller.signal
    });
    return parseChatCompletionResponse(response.status, await response.text(), apiKey);
  } catch (error) {
    if (token.isCancellationRequested) {
      throw new Error("AI explanations cancelled.");
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The AI service request was interrupted.");
    }
    throw error;
  } finally {
    cancellation.dispose();
  }
}
