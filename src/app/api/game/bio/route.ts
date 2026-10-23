import { BIO_INSTRUCTIONS, BioSchema, bioKey, buildBioPrompt, clipBio } from "@/engine/bios";
import { getScenario } from "@/engine/scenarios";
import { wantsDemo } from "@/server/demo";
import { rejectNonLocal } from "@/server/guard";
import { completeJson } from "@/server/llm";
import { badRequest, readGameRequest } from "@/server/requests";
import { ndjsonResponse } from "@/server/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * A short biography of the leader or a minister (engine/bios.ts), up to the
 * game's start date, in the player's language. The client asks once per
 * person and language, and keeps the clipped answer in the save.
 */
export async function POST(request: Request) {
  const rejected = rejectNonLocal(request);
  if (rejected) return rejected;
  const demo = wantsDemo(request);
  const parsed = await readGameRequest(request);
  if (parsed instanceof Response) return parsed;
  const { state, locale, model, body } = parsed;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 120) return badRequest("The name is empty or too long.");
  const startDate = getScenario(state.scenarioId).startDate;

  return ndjsonResponse(request, async ({ signal, progress }) => {
    let chars = 0;
    const reply = await completeJson(
      {
        model,
        demo,
        locale,
        instructions: BIO_INSTRUCTIONS(locale, startDate),
        input: [{ role: "user", content: buildBioPrompt(state, name, startDate) }],
        signal,
        onDelta: (delta) => progress((chars += delta.length)),
      },
      BioSchema,
    );
    return { key: bioKey(state, name), bio: clipBio(reply.bio) };
  });
}
