/**
 * Extract and parse JSON from a Claude response that may be wrapped
 * in markdown code fences or have preamble/postamble text.
 */
export function parseAiJson<T>(raw: string): T {
  let cleaned = raw.trim();

  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // If still not starting with { or [, try to find the first { ... } or [ ... ]
  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    const objStart = cleaned.indexOf("{");
    const arrStart = cleaned.indexOf("[");
    const start = objStart >= 0 && arrStart >= 0
      ? Math.min(objStart, arrStart)
      : Math.max(objStart, arrStart);
    if (start >= 0) {
      cleaned = cleaned.slice(start);
    }
  }

  return JSON.parse(cleaned) as T;
}
