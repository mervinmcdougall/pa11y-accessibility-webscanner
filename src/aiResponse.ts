export interface Explanation {
  id: string;
  explanation: string;
  recommendation: string;
}

function findJsonArray(response: string): unknown[] | undefined {
  const text = response.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const value: unknown = JSON.parse(text);
    if (Array.isArray(value)) {
      return value;
    }
  } catch {
    // Models sometimes wrap an otherwise valid JSON array in introductory text.
  }

  for (let start = text.indexOf("["); start !== -1; start = text.indexOf("[", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let end = start; end < text.length; end += 1) {
      const character = text[end];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === "\"") {
          inString = false;
        }
        continue;
      }
      if (character === "\"") {
        inString = true;
      } else if (character === "[") {
        depth += 1;
      } else if (character === "]") {
        depth -= 1;
        if (depth === 0) {
          try {
            const value: unknown = JSON.parse(text.slice(start, end + 1));
            if (Array.isArray(value)) {
              return value;
            }
          } catch {
            break;
          }
        }
      }
    }
  }
  return undefined;
}

/** Validates model output and ensures it contains every requested finding. */
export function parseExplanations(response: string, expectedIds: Set<string>): Explanation[] {
  const value = findJsonArray(response);
  if (!value) {
    const preview = response.slice(0, 500);
    const truncated = response.length > preview.length ? " (truncated)" : "";
    throw new Error(
      `The language model did not return a readable JSON array. ` +
      `Response length: ${response.length} characters; first ${preview.length}: ${JSON.stringify(preview)}${truncated}. ` +
      "Try explaining the findings again."
    );
  }

  const explanations: Explanation[] = [];
  for (const item of value) {
    if (
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      "explanation" in item &&
      "recommendation" in item &&
      typeof item.id === "string" &&
      expectedIds.has(item.id) &&
      typeof item.explanation === "string" &&
      typeof item.recommendation === "string"
    ) {
      explanations.push({
        id: item.id,
        explanation: item.explanation,
        recommendation: item.recommendation
      });
    }
  }
  const returnedIds = new Set(explanations.map((item) => item.id));
  const missingIds = [...expectedIds].filter((id) => !returnedIds.has(id));
  if (missingIds.length) {
    throw new Error("The language model did not explain every finding. Try explaining the findings again.");
  }
  return explanations;
}
