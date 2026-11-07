import { buildSuggestPrompt, cleanSuggestions, readSuggestRequest, SUGGEST_INSTRUCTIONS, SuggestSchema } from "@/engine/suggest";
import { wantsDemo } from "@/server/demo";
import { rejectNonLocal } from "@/server/guard";
import { completeJson } from "@/server/llm";
import { badRequest, readGameRequest } from "@/server/requests";
import { ndjsonResponse } from "@/server/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Names to choose from for a rename by order, or an order drafted in the style of a decree (engine/suggest.ts). */
export async function POST(request: Request) {
  const rejected = rejectNonLocal(request);
  if (rejected) return rejected;
  const demo = wantsDemo(request);
  const parsed = await readGameRequest(request);
  if (parsed instanceof Response) return parsed;
  const { state, locale, model, body } = parsed;
  const ask = readSuggestRequest(body);
  if (!ask) return badRequest("Unknown or malformed suggestion request.");

  return ndjsonResponse(request, async ({ signal, progress }) => {
    let chars = 0;
    const reply = await completeJson(
      {
        model,
        demo,
        locale,
        instructions: SUGGEST_INSTRUCTIONS(ask, locale),
        input: [{ role: "user", content: buildSuggestPrompt(state, ask) }],
        signal,
        onDelta: (delta) => progress((chars += delta.length)),
      },
      SuggestSchema,
    );
    return { options: cleanSuggestions(reply.options, ask) };
  });
}
