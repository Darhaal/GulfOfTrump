import { CandidatesSchema } from "@/engine/government";
import { buildCandidatesPrompt, CANDIDATES_INSTRUCTIONS } from "@/engine/prompts";
import { OFFICIAL_POSTS, type OfficialPost } from "@/engine/types";
import { wantsDemo } from "@/server/demo";
import { rejectNonLocal } from "@/server/guard";
import { completeJson } from "@/server/llm";
import { badRequest, MAX_MESSAGE_CHARS, readGameRequest } from "@/server/requests";
import { ndjsonResponse } from "@/server/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Candidates for a post in the player's government, with what speaks for and against each. */
export async function POST(request: Request) {
  const rejected = rejectNonLocal(request);
  if (rejected) return rejected;
  const demo = wantsDemo(request);
  const parsed = await readGameRequest(request);
  if (parsed instanceof Response) return parsed;
  const { state, locale, model, body } = parsed;
  const post = body.post as OfficialPost;
  if (!OFFICIAL_POSTS.includes(post)) return badRequest("Unknown post.");
  const wishes = typeof body.wishes === "string" ? body.wishes.trim() : "";
  if (wishes.length > MAX_MESSAGE_CHARS) return badRequest("The wishes are too long.");

  return ndjsonResponse(request, async ({ signal, progress }) => {
    let chars = 0;
    const reply = await completeJson(
      {
        model,
        demo,
        locale,
        instructions: CANDIDATES_INSTRUCTIONS(locale),
        input: [{ role: "user", content: buildCandidatesPrompt(state, post, wishes) }],
        signal,
        onDelta: (delta) => progress((chars += delta.length)),
      },
      CandidatesSchema,
    );
    return { candidates: reply.candidates };
  });
}
