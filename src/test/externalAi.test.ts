import assert from "node:assert/strict";
import test from "node:test";
import type { CancellationToken } from "vscode";
import { parseChatCompletionResponse, requestChatCompletion } from "../externalAi";

function cancellationToken(): CancellationToken {
  return {
    isCancellationRequested: false,
    onCancellationRequested: () => ({ dispose() {} })
  };
}

test("reads text from a successful chat completion", () => {
  assert.equal(
    parseChatCompletionResponse(200, JSON.stringify({
      choices: [{ message: { content: '[{"id":"one"}]' } }]
    })),
    '[{"id":"one"}]'
  );
});

test("joins text parts from a multipart chat completion", () => {
  assert.equal(
    parseChatCompletionResponse(200, JSON.stringify({
      choices: [{ message: { content: [{ type: "text", text: "hello" }, { type: "image", data: "ignored" }] } }]
    })),
    "hello"
  );
});

test("reports external API errors without exposing request credentials", () => {
  assert.throws(
    () => parseChatCompletionResponse(401, JSON.stringify({ error: { message: "Invalid API key" } })),
    /HTTP 401\): Invalid API key\./
  );
  assert.throws(() => parseChatCompletionResponse(200, "not json"), /invalid response \(HTTP 200\)/);
  assert.throws(
    () => parseChatCompletionResponse(400, JSON.stringify({ error: { message: "Rejected secret-key" } }), "secret-key"),
    /Rejected \[redacted\]/
  );
});

test("sends a bearer-authenticated request to the configured endpoint", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const fetchRequest: typeof fetch = async (input, init) => {
    requestUrl = input.toString();
    requestInit = init;
    return new Response(JSON.stringify({
      choices: [{ message: { content: "model response" } }]
    }), { status: 200 });
  };

  const result = await requestChatCompletion(
    "Explain findings",
    "https://api.example.test/v1/",
    "test-model",
    "secret-key",
    cancellationToken(),
    fetchRequest
  );

  assert.equal(result, "model response");
  assert.equal(requestUrl, "https://api.example.test/v1/chat/completions");
  assert.equal(new Headers(requestInit?.headers).get("authorization"), "Bearer secret-key");
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
    model: "test-model",
    messages: [{ role: "user", content: "Explain findings" }]
  });
});

test("rejects remote HTTP endpoints before sending the API key", async () => {
  let requestSent = false;
  const fetchRequest: typeof fetch = async () => {
    requestSent = true;
    return new Response();
  };

  await assert.rejects(
    requestChatCompletion(
      "prompt",
      "http://api.example.test/v1",
      "test-model",
      "secret-key",
      cancellationToken(),
      fetchRequest
    ),
    /must use HTTPS/
  );
  assert.equal(requestSent, false);
});
