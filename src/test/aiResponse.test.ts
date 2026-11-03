import assert from "node:assert/strict";
import test from "node:test";
import { parseExplanations } from "../aiResponse";

const expectedIds = new Set(["finding-1"]);
const explanation = {
  id: "finding-1",
  explanation: "Some users may not understand the image.",
  recommendation: "Provide alternative text."
};

test("parses a JSON array surrounded by model commentary", () => {
  assert.deepEqual(
    parseExplanations(`Here is the result:\n${JSON.stringify([explanation])}\nHope this helps.`, expectedIds),
    [explanation]
  );
});

test("parses a fenced JSON array", () => {
  assert.deepEqual(
    parseExplanations(`\`\`\`json\n${JSON.stringify([explanation])}\n\`\`\``, expectedIds),
    [explanation]
  );
});

test("rejects output without a readable JSON array", () => {
  assert.throws(() => parseExplanations("I could not produce the requested format.", expectedIds), /JSON array/);
});

test("rejects a JSON array that omits a requested finding", () => {
  assert.throws(() => parseExplanations("[]", expectedIds), /did not explain every finding/);
});
