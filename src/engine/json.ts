/**
 * Pulls the JSON object out of a model's answer. Models asked for "JSON only"
 * still sometimes wrap it in a ```json fence or add a sentence before it.
 */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new SyntaxError("The answer contains no JSON object.");
  return JSON.parse(body.slice(start, end + 1));
}

/** Fields where null means something: a cancelled election is not the same as no change. */
const MEANINGFUL_NULLS = new Set(["nextElection"]);

/**
 * A model writes null for "nothing" where the answer's schema expects a
 * field to be left out ("overthrow": null, "to": null). Null fields and null
 * list items are removed — except where null means something — so an answer
 * that follows the spirit of its shape is not thrown away over it.
 */
export function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.filter((v) => v !== null).map(withoutNulls);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (v === null && !MEANINGFUL_NULLS.has(key)) continue;
      out[key] = withoutNulls(v);
    }
    return out;
  }
  return value;
}
