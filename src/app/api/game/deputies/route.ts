import { ADVISORS, type AdvisorId } from "@/engine/advisors";
import { DeputiesSetupSchema } from "@/engine/deputies";
import { buildDeputiesPrompt, DEPUTIES_INSTRUCTIONS } from "@/engine/deputyPrompts";
import { ADVISOR_POST } from "@/engine/government";
import { wantsDemo } from "@/server/demo";
import { rejectNonLocal } from "@/server/guard";
import { completeJson } from "@/server/llm";
import { badRequest, readGameRequest } from "@/server/requests";
import { ndjsonResponse } from "@/server/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * One ministry's deputies, named once by the game master when the player
 * first asks after the ministry's people. What the dice deal them (their
 * ambition, their loyalty to their chief) is the engine's, in the browser.
 */
export async function POST(request: Request) {
  const rejected = rejectNonLocal(request);
  if (rejected) return rejected;
  // The offline demo answers instead of ChatGPT (server/demo.ts).
  const demo = wantsDemo(request);
  const parsed = await readGameRequest(request);
  if (parsed instanceof Response) return parsed;
  const { state, locale, model, body } = parsed;
  const ministry = body.ministry as AdvisorId;
  if (!ADVISORS.includes(ministry)) return badRequest("Unknown ministry.");

  return ndjsonResponse(request, async ({ signal, progress }) => {
    let chars = 0;
    const reply = await completeJson(
      {
        model,
        demo,
        locale,
        instructions: DEPUTIES_INSTRUCTIONS(locale),
        input: [{ role: "user", content: buildDeputiesPrompt(state, ADVISOR_POST[ministry], ministry) }],
        signal,
        onDelta: (delta) => progress((chars += delta.length)),
      },
      DeputiesSetupSchema,
    );
    return { deputies: reply.deputies };
  });
}
